import type { EvidenceInput, EvidenceMetadata } from '../domain/evidence'
import { isValidEvidenceMetadata, validateEvidenceFile, validateEvidenceSignature } from '../domain/evidence'
import { createEvidenceExtraction, isValidEvidenceExtraction, reviewCandidate } from '../domain/extraction'
import type { EvidenceExtraction } from '../domain/extraction'
import { recordAuditEvent } from './auditRepository'

// Preserve locally stored originals created before the public Buktiva rename.
// IndexedDB database names are implementation details and are never displayed to users.
const DATABASE_NAME = 'tuntiva-prototype'
const DATABASE_VERSION = 2
const METADATA_STORE = 'evidence-metadata'
const ORIGINAL_STORE = 'evidence-originals'
const EXTRACTION_STORE = 'evidence-extractions'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(METADATA_STORE)) database.createObjectStore(METADATA_STORE, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(ORIGINAL_STORE)) database.createObjectStore(ORIGINAL_STORE)
      if (!database.objectStoreNames.contains(EXTRACTION_STORE)) {
        const store = database.createObjectStore(EXTRACTION_STORE, { keyPath: 'id' })
        store.createIndex('evidenceId', 'evidenceId')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open evidence storage.'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Evidence storage failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Evidence storage was cancelled.'))
  })
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function addEvidence(file: File, input: EvidenceInput): Promise<EvidenceMetadata> {
  const validationError = validateEvidenceFile(file)
  if (validationError) throw new Error(validationError)
  const signatureError = validateEvidenceSignature(file.type, new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (signatureError) throw new Error(signatureError)

  const metadata: EvidenceMetadata = {
    id: crypto.randomUUID(),
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    sha256: await sha256(file),
    sourceType: input.sourceType,
    eventDate: input.eventDate || null,
    description: input.description.trim(),
    includeInPack: true,
    uploadedAt: new Date().toISOString(),
  }
  const extraction = file.type === 'text/plain' ? createEvidenceExtraction(metadata.id, (await file.text()).slice(0, 500_000)) : null

  const database = await openDatabase()
  const transaction = database.transaction([METADATA_STORE, ORIGINAL_STORE, EXTRACTION_STORE], 'readwrite')
  transaction.objectStore(METADATA_STORE).add(metadata)
  transaction.objectStore(ORIGINAL_STORE).add(file, metadata.id)
  if (extraction?.candidates.length) transaction.objectStore(EXTRACTION_STORE).add(extraction)
  await transactionDone(transaction)
  database.close()
  return metadata
}

export async function listEvidence(): Promise<EvidenceMetadata[]> {
  const database = await openDatabase()
  const transaction = database.transaction(METADATA_STORE, 'readonly')
  const request = transaction.objectStore(METADATA_STORE).getAll()
  const records = await new Promise<EvidenceMetadata[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result.filter(isValidEvidenceMetadata))
    request.onerror = () => reject(request.error)
  })
  database.close()
  return records.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
}

export async function getEvidenceOriginal(id: string): Promise<Blob | null> {
  const database = await openDatabase()
  const transaction = database.transaction(ORIGINAL_STORE, 'readonly')
  const request = transaction.objectStore(ORIGINAL_STORE).get(id)
  const original = await new Promise<Blob | null>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
  database.close()
  return original
}

export async function listExtractions(): Promise<EvidenceExtraction[]> {
  const database = await openDatabase()
  const transaction = database.transaction(EXTRACTION_STORE, 'readonly')
  const request = transaction.objectStore(EXTRACTION_STORE).getAll()
  const records = await new Promise<EvidenceExtraction[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result.filter(isValidEvidenceExtraction))
    request.onerror = () => reject(request.error)
  })
  database.close()
  return records
}

export async function reviewExtractionCandidate(extractionId: string, candidateId: string, status: 'unconfirmed' | 'confirmed' | 'rejected', correctedValue?: string): Promise<EvidenceExtraction> {
  const database = await openDatabase()
  const transaction = database.transaction(EXTRACTION_STORE, 'readwrite')
  const store = transaction.objectStore(EXTRACTION_STORE)
  const request = store.get(extractionId)
  const updated = await new Promise<EvidenceExtraction>((resolve, reject) => {
    request.onsuccess = () => {
      const extraction = request.result as EvidenceExtraction | undefined
      if (!extraction) { reject(new Error('Extraction record not found.')); return }
      try {
        const next = { ...extraction, candidates: extraction.candidates.map((item) => item.id === candidateId ? reviewCandidate(item, status, correctedValue) : item) }
        store.put(next); resolve(next)
      } catch (error) { database.close(); reject(error) }
    }
    request.onerror = () => reject(request.error)
  })
  await transactionDone(transaction); database.close()
  const reviewed = updated.candidates.find((item) => item.id === candidateId)
  if (reviewed) recordAuditEvent('derived_fact_reviewed', candidateId, `${reviewed.field}: ${status}`)
  return updated
}

export async function updateEvidenceInclusion(id: string, includeInPack: boolean): Promise<boolean> {
  const database = await openDatabase()
  const transaction = database.transaction(METADATA_STORE, 'readwrite')
  const store = transaction.objectStore(METADATA_STORE)
  const request = store.get(id)
  let updated = false
  request.onsuccess = () => {
    const existing = request.result as EvidenceMetadata | undefined
    if (existing) { store.put({ ...existing, includeInPack }); updated = true }
  }
  await transactionDone(transaction)
  database.close()
  return updated
}

export async function deleteEvidence(id: string): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction([METADATA_STORE, ORIGINAL_STORE, EXTRACTION_STORE], 'readwrite')
  transaction.objectStore(METADATA_STORE).delete(id)
  transaction.objectStore(ORIGINAL_STORE).delete(id)
  const extractionStore = transaction.objectStore(EXTRACTION_STORE)
  const extractionKeys = extractionStore.index('evidenceId').getAllKeys(id)
  extractionKeys.onsuccess = () => extractionKeys.result.forEach((key) => extractionStore.delete(key))
  await transactionDone(transaction)
  database.close()
}

export async function clearEvidence(): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction([METADATA_STORE, ORIGINAL_STORE, EXTRACTION_STORE], 'readwrite')
  transaction.objectStore(METADATA_STORE).clear()
  transaction.objectStore(ORIGINAL_STORE).clear()
  transaction.objectStore(EXTRACTION_STORE).clear()
  await transactionDone(transaction)
  database.close()
}
