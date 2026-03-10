import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { DecipherGCM } from 'node:crypto'
import { Transform } from 'node:stream'

const MAGIC = Buffer.from('ADUENBK1', 'ascii')
const NONCE_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

export type BackupKeyring = Readonly<Record<string, Buffer>>

export function createBackupSealer(activeKeyId: string, keyring: BackupKeyring): Transform {
  const key = requireKey(keyring, activeKeyId)
  const keyId = validateKeyId(activeKeyId)
  const nonce = randomBytes(NONCE_BYTES)
  const header = Buffer.concat([MAGIC, Buffer.from([Buffer.byteLength(keyId)]), Buffer.from(keyId, 'ascii'), nonce])
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(header)
  let headerWritten = false
  const writeHeader = (stream: Transform) => {
    if (headerWritten) return
    stream.push(header)
    headerWritten = true
  }
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      try { writeHeader(this); this.push(cipher.update(chunk)); callback() } catch (error) { callback(error as Error) }
    },
    flush(callback) {
      try {
        writeHeader(this)
        this.push(cipher.final())
        this.push(cipher.getAuthTag())
        callback()
      } catch (error) { callback(error as Error) }
    },
  })
}

export function createBackupOpener(keyring: BackupKeyring): Transform {
  let pending = Buffer.alloc(0)
  let tail = Buffer.alloc(0)
  let decipher: DecipherGCM | undefined
  let headerLength = 0

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      try {
        if (!decipher) {
          pending = Buffer.concat([pending, chunk])
          if (pending.length >= MAGIC.length + 1) {
            if (!pending.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('invalid_backup_archive')
            const keyIdLength = pending[MAGIC.length]!
            if (keyIdLength < 1 || keyIdLength > 64) throw new Error('invalid_backup_archive')
            headerLength = MAGIC.length + 1 + keyIdLength + NONCE_BYTES
          }
          if (!headerLength || pending.length < headerLength) return callback()
          const keyIdBytes = pending.subarray(MAGIC.length + 1, MAGIC.length + 1 + pending[MAGIC.length]!)
          const keyId = keyIdBytes.toString('ascii')
          if (!Buffer.from(keyId, 'ascii').equals(keyIdBytes)) throw new Error('invalid_backup_archive')
          const key = requireKey(keyring, keyId)
          const nonce = pending.subarray(headerLength - NONCE_BYTES, headerLength)
          decipher = createDecipheriv('aes-256-gcm', key, nonce)
          decipher.setAAD(pending.subarray(0, headerLength))
          chunk = pending.subarray(headerLength)
          pending = Buffer.alloc(0)
        }
        if (chunk.length) {
          const combined = Buffer.concat([tail, chunk])
          if (combined.length > TAG_BYTES) {
            const ciphertext = combined.subarray(0, combined.length - TAG_BYTES)
            tail = combined.subarray(combined.length - TAG_BYTES)
            this.push(decipher.update(ciphertext))
          } else tail = combined
        }
        callback()
      } catch (error) { callback(error as Error) }
    },
    flush(callback) {
      if (!decipher || pending.length || tail.length !== TAG_BYTES) return callback(new Error('invalid_backup_archive'))
      try {
        decipher.setAuthTag(tail)
        this.push(decipher.final())
        callback()
      } catch { callback(new Error('backup_authentication_failed')) }
    },
  })
}

export function readBackupKeyring(value: string): BackupKeyring {
  let parsed: unknown
  try { parsed = JSON.parse(value) } catch { throw new Error('BACKUP_ENCRYPTION_KEYRING must be a JSON object of key IDs to base64 keys.') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('BACKUP_ENCRYPTION_KEYRING must be a JSON object of key IDs to base64 keys.')
  const keyring: Record<string, Buffer> = Object.create(null) as Record<string, Buffer>
  for (const [keyId, encoded] of Object.entries(parsed)) {
    if (typeof encoded !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)) throw new Error('Backup keyring contains an invalid base64 key.')
    const key = Buffer.from(encoded, 'base64')
    if (key.toString('base64') !== encoded || key.length !== KEY_BYTES) throw new Error('Every backup key must be exactly 32 bytes encoded as base64.')
    validateKeyId(keyId)
    keyring[keyId] = key
  }
  if (!Object.keys(keyring).length) throw new Error('Backup keyring must contain at least one key.')
  return keyring
}

function validateKeyId(keyId: string): string {
  if (!/^[A-Za-z0-9._-]{1,64}$/u.test(keyId)) throw new Error('Backup key IDs must be 1 to 64 ASCII letters, digits, dots, underscores, or hyphens.')
  return keyId
}

function requireKey(keyring: BackupKeyring, keyId: string): Buffer {
  validateKeyId(keyId)
  const key = keyring[keyId]
  if (!key || key.length !== KEY_BYTES) throw new Error('A valid 32-byte key is required for the selected backup key ID.')
  return key
}
