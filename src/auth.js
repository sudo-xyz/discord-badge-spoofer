"use strict";

/**
 * pastes a discord user token + cf_clearance cookie and we take it from there.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const { ENDPOINTS, CLIENT } = require("./config");
const vault = require("./vault");
const { CH } = require("./log");

function userIdFromToken(token) {
  try {
    const head = String(token).split(".", 1)[0];
    const pad = "=".repeat((4 - (head.length % 4)) % 4);
    const id = Buffer.from(head + pad, "base64").toString("utf-8");
    return /^\d{5,}$/.test(id) ? id : "";
  } catch (_) {
    return "";
  }
}

function buildHeaders(extra = {}) {
  return {
    accept: "*/*",
    "accept-language": CLIENT.locale,
    authorization: vault.load().token,
    origin: "https://discord.com",
    referer: "https://discord.com/channels/@me",
    "user-agent": CLIENT.agent,
    "x-debug-options": "bugReporterEnabled",
    "x-discord-locale": CLIENT.locale,
    "x-discord-timezone": CLIENT.timezone,
    ...extra,
  };
}

async function mintAnalyticsToken(superPropsB64) {
  const res = await fetch(ENDPOINTS.identity, {
    headers: buildHeaders({ "x-super-properties": superPropsB64 }),
  });
  if (!res.ok) throw new Error(`identity check failed (http ${res.status})`);
  const data = await res.json();
  if (!data || !data.analytics_token) throw new Error("no analytics token in response");
  return data.analytics_token;
}

async function verifyToken() {
  // quick /users/@me probe; throws on anything but 200
  const res = await fetch(ENDPOINTS.identity, {
    headers: buildHeaders({ "x-super-properties": Buffer.from("{}").toString("base64") }),
  });
  if (!res.ok) throw new Error(`token rejected (http ${res.status})`);
  return true;
}

// ------------------------------------------------------------------ fingerprint

// powershell that mirrors discord's executable_fingerprint: pe metadata, machine
// guid binding, signing cert hash, xor-obfuscated with a user-derived key.
// based on dolfies' public writeup.
const FP_SCRIPT = String.raw`
param(
  [int]$ProcessId = 0,
  [string]$Path,
  [Parameter(Mandatory = $true)][string]$UserId
)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class CertPubKeyHash {
  const uint X509_ASN_ENCODING = 0x00000001;
  const uint PKCS_7_ASN_ENCODING = 0x00010000;
  const uint CALG_SHA_256 = 0x0000800C;

  [StructLayout(LayoutKind.Sequential)] struct Blob { public uint cbData; public IntPtr pbData; }
  [StructLayout(LayoutKind.Sequential)] struct AlgId { public IntPtr pszObjId; public Blob Parameters; }
  [StructLayout(LayoutKind.Sequential)] struct BitBlob { public uint cbData; public IntPtr pbData; public uint cUnusedBits; }
  [StructLayout(LayoutKind.Sequential)] struct PubKeyInfo { public AlgId Algorithm; public BitBlob PublicKey; }
  [StructLayout(LayoutKind.Sequential)] struct FileTime { public uint Low; public uint High; }
  [StructLayout(LayoutKind.Sequential)]
  struct CertInfo {
    public uint Version; public Blob SerialNumber; public AlgId SignatureAlgorithm; public Blob Issuer;
    public FileTime NotBefore; public FileTime NotAfter; public Blob Subject;
    public PubKeyInfo SubjectPublicKeyInfo; public BitBlob IssuerUniqueId; public BitBlob SubjectUniqueId;
    public uint ExtensionCount; public IntPtr Extensions;
  }
  [StructLayout(LayoutKind.Sequential)]
  struct CertContext {
    public uint EncodingType; public IntPtr Encoded; public uint EncodedSize;
    public IntPtr CertInfo; public IntPtr Store;
  }

  [DllImport("crypt32.dll", SetLastError = true)]
  static extern bool CryptHashPublicKeyInfo(
    IntPtr provider, uint algid, uint flags, uint encoding, ref PubKeyInfo info, byte[] hash, ref uint hashSize);

  public static byte[] Hash(IntPtr certContext) {
    var ctx = Marshal.PtrToStructure<CertContext>(certContext);
    var info = Marshal.PtrToStructure<CertInfo>(ctx.CertInfo);
    var hash = new byte[32];
    uint hashSize = 32;
    if (!CryptHashPublicKeyInfo(IntPtr.Zero, CALG_SHA_256, 0, X509_ASN_ENCODING | PKCS_7_ASN_ENCODING, ref info.SubjectPublicKeyInfo, hash, ref hashSize) || hashSize != 32)
      throw new InvalidOperationException("CryptHashPublicKeyInfo failed");
    return hash;
  }
}
"@

if (!$Path) {
  if (!$ProcessId) { throw "Pass -Path <exe> or -ProcessId <pid>." }
  $Path = (Get-Process -Id $ProcessId).Path
}
if (!$Path) { throw "Could not resolve executable path." }

$fs = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete)
try {
  $fileSize = [UInt64]$fs.Length
  $readSize = [int][Math]::Min($fs.Length, 0x10064)
  $buf = [byte[]]::new($readSize)
  $read = $fs.Read($buf, 0, $readSize)
  if ($read -lt 0x40) { throw "File prefix is too small." }
  if ($read -ne $readSize) { [Array]::Resize([ref]$buf, $read) }
} finally {
  $fs.Dispose()
}

if ([BitConverter]::ToUInt16($buf, 0) -ne 0x5A4D) { throw "Not an MZ executable." }
$pe = [BitConverter]::ToInt32($buf, 0x3C)
if ($pe -lt 0 -or [BitConverter]::ToUInt32($buf, $pe) -ne 0x4550) { throw "Not a PE executable." }

$fh = $pe + 4
$sections = [BitConverter]::ToUInt16($buf, $fh + 2)
$timestamp = [BitConverter]::ToUInt32($buf, $fh + 4)
$optSize = [BitConverter]::ToUInt16($buf, $fh + 16)
$opt = $fh + 20
if ([BitConverter]::ToUInt16($buf, $opt) -ne 0x20B) { throw "Discord only fingerprints PE32+." }
$sizeOfImage = [BitConverter]::ToUInt32($buf, $opt + 56)

$sectionTable = $opt + $optSize
$sha256 = [Security.Cryptography.SHA256]::Create()
$headerHash = $sha256.ComputeHash([byte[]]$buf[0..($sectionTable - 1)])
$sectionHash = $sha256.ComputeHash([byte[]]$buf[$sectionTable..($sectionTable + $sections * 40 - 1)])

$machineGuid = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name MachineGuid).MachineGuid
$machineUserHash = $sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($machineGuid + $UserId))

$sig = Get-AuthenticodeSignature -LiteralPath $Path
$signed = $sig.Status -eq "Valid" -and $sig.SignerCertificate
if ($signed) {
  $name = $sig.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
  $certHash = $sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($name) + [CertPubKeyHash]::Hash($sig.SignerCertificate.Handle))
} else {
  $certHash = [byte[]]::new(32)
}

$flags = 0
if ($signed) { $flags += 1 }

$out = [byte[]](@(1, [byte]$flags) +
  [BitConverter]::GetBytes($fileSize) +
  [BitConverter]::GetBytes($timestamp) +
  [BitConverter]::GetBytes($sizeOfImage) +
  $headerHash + $machineUserHash + $sectionHash + $certHash)

$key = $sha256.ComputeHash([UTF8Encoding]::new($false).GetBytes($UserId + "https://discord.com/careers"))
for ($i = 1; $i -lt $out.Length; $i++) {
  $out[$i] = $out[$i] -bxor $key[($i - 1) -band 31]
}

[Convert]::ToBase64String($out)
`;

async function generateFingerprint(userId, exePath = "", pid = 0) {
  if (process.platform !== "win32") {
    throw new Error("fingerprint generation is windows-only");
  }
  const scriptPath = path.join(os.tmpdir(), `orcabase_fp_${crypto.randomUUID().replace(/-/g, "")}.ps1`);
  fs.writeFileSync(scriptPath, FP_SCRIPT, "utf-8");
  try {
    const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-UserId", userId];
    if (pid) args.push("-ProcessId", String(pid));
    else args.push("-Path", exePath);

    let stdout = "";
    try {
      const result = await execFileAsync("powershell", args, { timeout: 60000 });
      stdout = result.stdout || "";
    } catch (err) {
      const text = String((err && (err.stderr || err.stdout)) || "").trim();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      throw new Error(lines.length ? lines[lines.length - 1] : "powershell failed");
    }
    const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) throw new Error("generator produced no output");
    return lines[lines.length - 1];
  } finally {
    try { fs.unlinkSync(scriptPath); } catch (_) {}
  }
}

module.exports = { userIdFromToken, mintAnalyticsToken, verifyToken, buildHeaders, generateFingerprint };
