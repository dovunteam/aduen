import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { test } from 'node:test'
import { createBackupOpener, createBackupSealer, readBackupKeyring } from '../dist/backupArchive.js'

const keyring = readBackupKeyring(JSON.stringify({ 'test-key-v1': Buffer.alloc(32, 7).toString('base64') }))

async function runTransform(chunks, transform) {
  const output = []
  await pipeline(Readable.from(chunks), transform, new Writable({ write(chunk, _encoding, callback) { output.push(Buffer.from(chunk)); callback() } }))
  return Buffer.concat(output)
}

test('backup archive encryption round-trips a large stream with a key ID in its authenticated header', async () => {
  const plaintext = Buffer.from('Synthetic hosted case backup\n'.repeat(20_000))
  const encrypted = await runTransform([plaintext.subarray(0, 101), plaintext.subarray(101)], createBackupSealer('test-key-v1', keyring))
  assert.equal(encrypted.subarray(0, 8).toString('ascii'), 'ADUENBK1')
  assert.equal(encrypted.subarray(9, 20).toString('ascii'), 'test-key-v1')
  assert.equal(encrypted.includes(plaintext), false)
  const restored = await runTransform(Array.from({ length: encrypted.length }, (_, index) => encrypted.subarray(index, index + 1)), createBackupOpener(keyring))
  assert.deepEqual(restored, plaintext)
})

test('backup archive rejects tampering, truncation, and unavailable rotation keys', async () => {
  const encrypted = await runTransform([Buffer.from('synthetic backup data')], createBackupSealer('test-key-v1', keyring))
  const tampered = Buffer.from(encrypted)
  tampered[30] ^= 1
  await assert.rejects(runTransform([tampered], createBackupOpener(keyring)), /backup_authentication_failed/u)
  await assert.rejects(runTransform([encrypted.subarray(0, -1)], createBackupOpener(keyring)), /backup_authentication_failed|invalid_backup_archive/u)
  await assert.rejects(runTransform([encrypted], createBackupOpener({})), /selected backup key ID/u)
})

test('backup keyring accepts only named 32-byte base64 keys', () => {
  assert.throws(() => readBackupKeyring('[]'), /JSON object/u)
  assert.throws(() => readBackupKeyring(JSON.stringify({ 'bad/key': Buffer.alloc(32).toString('base64') })), /key IDs/u)
  assert.throws(() => readBackupKeyring(JSON.stringify({ 'key-v1': Buffer.alloc(31).toString('base64') })), /exactly 32 bytes/u)
})

test('backup archives remain openable across an active key rotation', async () => {
  const rotatedKeyring = { ...keyring, 'test-key-v2': Buffer.alloc(32, 8) }
  const previousArchive = await runTransform([Buffer.from('older synthetic archive')], createBackupSealer('test-key-v1', rotatedKeyring))
  const nextArchive = await runTransform([Buffer.from('newer synthetic archive')], createBackupSealer('test-key-v2', rotatedKeyring))
  assert.deepEqual(await runTransform([previousArchive], createBackupOpener(rotatedKeyring)), Buffer.from('older synthetic archive'))
  assert.deepEqual(await runTransform([nextArchive], createBackupOpener(rotatedKeyring)), Buffer.from('newer synthetic archive'))
})

test('backup CLI seals and opens standard streams using the configured keyring', () => {
  const plaintext = Buffer.from('synthetic command-line dump')
  const scratch = mkdtempSync(join(tmpdir(), 'aduen-backup-test-'))
  const env = {
    PATH: process.env.PATH ?? '',
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    BACKUP_ACTIVE_KEY_ID: 'test-key-v1',
    BACKUP_ENCRYPTION_KEYRING: JSON.stringify({ 'test-key-v1': Buffer.alloc(32, 7).toString('base64') }),
    BACKUP_SCRATCH_DIR: scratch,
  }
  try {
    const sealed = spawnSync(process.execPath, ['dist/backupArchiveCli.js', 'seal'], { input: plaintext, env, maxBuffer: 1024 * 1024 })
    assert.equal(sealed.status, 0, sealed.stderr.toString())
    assert.equal(sealed.stdout.includes(plaintext), false)
    const opened = spawnSync(process.execPath, ['dist/backupArchiveCli.js', 'open'], { input: sealed.stdout, env, maxBuffer: 1024 * 1024 })
    assert.equal(opened.status, 0, opened.stderr.toString())
    assert.deepEqual(opened.stdout, plaintext)
    assert.deepEqual(readdirSync(scratch), [])
    const tampered = Buffer.from(sealed.stdout)
    tampered[30] ^= 1
    const rejected = spawnSync(process.execPath, ['dist/backupArchiveCli.js', 'open'], { input: tampered, env, maxBuffer: 1024 * 1024 })
    assert.equal(rejected.status, 1)
    assert.equal(rejected.stdout.length, 0)
    assert.deepEqual(readdirSync(scratch), [])
  } finally { rmSync(scratch, { recursive: true, force: true }) }
})
