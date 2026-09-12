import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfText, PdfParseError } from '../src/pdf.js';

// A tiny hand-built one-page PDF: two paragraphs separated by a wide vertical gap. Embedded as
// base64 so the suite needs no binary fixture on disk and no PDF-authoring dependency.
const FIXTURE_B64 =
  'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXS9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNSAwIFI+Pj4+L0NvbnRlbnRzIDQgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvTGVuZ3RoIDI4Nz4+CnN0cmVhbQpCVCAvRjEgMTIgVGYgNzIgNzAwIFRkIChQYXJhZ3JhcGggb25lIGxpbmUgb25lIGFib3V0IHRoZSBxdWFycnkuKSBUagowIC0xNCBUZCAoUGFyYWdyYXBoIG9uZSBsaW5lIHR3byBjb250aW51ZXMgaGVyZS4pIFRqCjAgLTE0IFRkIChQYXJhZ3JhcGggb25lIGxpbmUgdGhyZWUgZW5kcyB0aGUgYmxvY2suKSBUagowIC02NCBUZCAoUGFyYWdyYXBoIHR3byBiZWdpbnMgYWZ0ZXIgYSB3aWRlIGdhcC4pIFRqCjAgLTE0IFRkIChQYXJhZ3JhcGggdHdvIHNlY29uZCBsaW5lIGNsb3NlcyBpdCBvdXQuKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU0IDAwMDAwIG4gCjAwMDAwMDAxMDUgMDAwMDAgbiAKMDAwMDAwMDIxNyAwMDAwMCBuIAowMDAwMDAwNTUzIDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNjE2CiUlRU9G';

test('pdfText extracts text and surfaces paragraph breaks as blank lines', async () => {
  const bytes = new Uint8Array(Buffer.from(FIXTURE_B64, 'base64'));
  const { text, pages, pageTexts } = await pdfText(bytes);
  assert.equal(pages, 1);
  assert.equal(pageTexts.length, 1);
  assert.match(text, /Paragraph one line one/);
  assert.match(text, /Paragraph two second line/);
  // The wide vertical gap between the two paragraphs must become a blank line, so chunkText
  // (which splits on blank lines) sees two paragraphs rather than one page-sized block.
  assert.match(text, /\n\s*\n/, 'a paragraph break should be emitted as a blank line');
  // Lines within a paragraph stay single-newline joined.
  assert.match(text, /Paragraph one line one about the quarry\.\nParagraph one line two/);
});

test('pdfText rejects missing or zero-length input with a TypeError', async () => {
  await assert.rejects(() => pdfText(), TypeError);
  await assert.rejects(() => pdfText(null), TypeError);
  await assert.rejects(() => pdfText(new Uint8Array(0)), TypeError); // truthy but empty
});

test('pdfText wraps a parse failure in PdfParseError', async () => {
  const notAPdf = new Uint8Array(Buffer.from('this is plainly not a pdf at all', 'utf8'));
  await assert.rejects(() => pdfText(notAPdf), (err) => {
    assert.ok(err instanceof PdfParseError, 'should be a PdfParseError');
    assert.equal(err.name, 'PdfParseError');
    assert.ok('cause' in err, 'should preserve the underlying pdfjs error on .cause');
    return true;
  });
});
