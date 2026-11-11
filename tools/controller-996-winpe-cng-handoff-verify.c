/*
 * #996 Windows CNG RSA-PSS/SHA256 SOURCE-ONLY primitive, not an Operator.
 * Never reads a path, mutates E:, touches GitHub, signs Owner consent, checks
 * runtime/clock/approval, or authorizes C-grade recovery. NO main() exists.
 * Selected WinPE x64 image compatibility and Owner trust are NOT established.
 *
 * The Node contract pins SPKI DER SHA256; this primitive consumes a Windows
 * BCRYPT_RSAPUBLIC_BLOB and checks its separately supplied SHA256. Before
 * any real integration, an independently approved trust anchor must bind
 * BOTH representations to the same Owner key; caller values do not do that.
 */
#include <stddef.h>
#include <stdint.h>
#include <string.h>

#if defined(C996_ENABLE_C_GRADE_OPERATOR)
#error C996_CNG_SOURCE_ONLY_NOT_AN_OPERATIONAL_C_APPROVAL_PORT
#endif

#if defined(_WIN32)
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0A00
#endif
#include <windows.h>
#include <bcrypt.h>
#if defined(_MSC_VER)
#pragma comment(lib, "bcrypt.lib")
#endif
#endif

typedef struct c996_cng_crypto_review {
  int signatureCryptographicallyVerified;
  int trustedOwnerKeyEstablished;
  int ownerApprovalVerified;
  int offlineClockTrusted;
  int winpeRuntimeVerified;
  int executionAuthorized;
  int operationalWrites;
} c996_cng_crypto_review;

/* All fields zero, including executionAuthorized, on any invalid input. */
c996_cng_crypto_review c996_source_only_verify_pss_sha256(
  const uint8_t *manifest, uint32_t manifestLength,
  const uint8_t *publicBlob, uint32_t publicBlobLength,
  const uint8_t expectedPublicBlobSha256[32],
  const uint8_t *signature, uint32_t signatureLength) {
  c996_cng_crypto_review review = {0};
#if defined(_WIN32)
  BCRYPT_ALG_HANDLE hashAlg = NULL;
  BCRYPT_ALG_HANDLE rsaAlg = NULL;
  BCRYPT_KEY_HANDLE rsaKey = NULL;
  BCRYPT_RSAKEY_BLOB header;
  BCRYPT_PSS_PADDING_INFO padding = {BCRYPT_SHA256_ALGORITHM, 32};
  uint8_t observedBlobSha256[32] = {0};
  uint8_t manifestSha256[32] = {0};
  uint64_t expectedSize;
  int valid = 0;

  if (!manifest || manifestLength == 0 || manifestLength > 8192 ||
      !publicBlob || !expectedPublicBlobSha256 || !signature ||
      publicBlobLength < sizeof(header) || publicBlobLength > 2048 ||
      signatureLength == 0 || signatureLength > 1024) return review;
  memcpy(&header, publicBlob, sizeof(header));
  expectedSize = (uint64_t)sizeof(header) + header.cbPublicExp +
    header.cbModulus;
  if (header.Magic != BCRYPT_RSAPUBLIC_MAGIC ||
      header.BitLength < 2048 || header.BitLength > 8192 ||
      header.BitLength % 8 != 0 ||
      header.cbPublicExp != 3 || header.cbModulus != header.BitLength / 8 ||
      header.cbPrime1 != 0 || header.cbPrime2 != 0 ||
      expectedSize != publicBlobLength ||
      signatureLength != header.cbModulus) return review;
  /* Restrict RSA e to the standard 65537, in big-endian encoding. */
  if (publicBlob[sizeof(header)] != 0x01 ||
      publicBlob[sizeof(header)+1] != 0x00 ||
      publicBlob[sizeof(header)+2] != 0x01) return review;

  if (BCryptOpenAlgorithmProvider(&hashAlg,BCRYPT_SHA256_ALGORITHM,NULL,0)<0)
    goto done;
  /* CNG hashes raw manifest bytes; unlike Node verify(), BCryptVerifySignature
   * takes the resulting 32-byte SHA256 digest as its pbHash input. */
  if (BCryptHash(hashAlg,NULL,0,(PUCHAR)publicBlob,publicBlobLength,
        observedBlobSha256,32)<0 ||
      memcmp(observedBlobSha256,expectedPublicBlobSha256,32)!=0 ||
      BCryptHash(hashAlg,NULL,0,(PUCHAR)manifest,manifestLength,
        manifestSha256,32)<0)goto done;

  if (BCryptOpenAlgorithmProvider(&rsaAlg,BCRYPT_RSA_ALGORITHM,NULL,0)<0 ||
      BCryptImportKeyPair(rsaAlg,NULL,BCRYPT_RSAPUBLIC_BLOB,&rsaKey,
        (PUCHAR)publicBlob,publicBlobLength,0)<0)goto done;
  valid = BCryptVerifySignature(rsaKey,&padding,manifestSha256,32,
    (PUCHAR)signature,signatureLength,BCRYPT_PAD_PSS)>=0;
done:
  if (rsaKey)BCryptDestroyKey(rsaKey);
  if (rsaAlg)BCryptCloseAlgorithmProvider(rsaAlg,0);
  if (hashAlg)BCryptCloseAlgorithmProvider(hashAlg,0);
  SecureZeroMemory(observedBlobSha256,sizeof(observedBlobSha256));
  SecureZeroMemory(manifestSha256,sizeof(manifestSha256));
  if (valid) review.signatureCryptographicallyVerified = 1;
#else
  (void)manifest;(void)manifestLength;(void)publicBlob;
  (void)publicBlobLength;(void)expectedPublicBlobSha256;
  (void)signature;(void)signatureLength;
#endif
  /* The function has no authority to establish these other results. */
  return review;
}
