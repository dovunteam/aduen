export const NOTICE_VERSION = 'prototype-privacy-and-role-v1'

export type ConsentRecord = {
  noticeVersion: string
  acceptedAt: string
  purpose: 'case-preparation-and-local-storage'
  withdrawalPath: 'data-controls'
}

export function createConsentRecord(now = new Date()): ConsentRecord {
  return { noticeVersion: NOTICE_VERSION, acceptedAt: now.toISOString(), purpose: 'case-preparation-and-local-storage', withdrawalPath: 'data-controls' }
}
