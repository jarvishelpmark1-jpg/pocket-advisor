import { describe, it, expect } from 'vitest'
import {
  identifyStatementText,
  identifyOFX,
  identifyFilename,
  mergeIdentities,
  suggestedAccountName,
} from './statement-identify'

describe('identifyStatementText (PDF path)', () => {
  it('reads a Bank of America checking statement header', () => {
    const id = identifyStatementText([
      'Bank of America',
      'P.O. Box 25118 Tampa, FL 33622-5118',
      'Your Adv SafeBalance Banking',
      'for May 9, 2026 to June 8, 2026',
      'Account number: 4460 1234 5678',
      'ZACH GAGNON',
    ])
    expect(id.institution).toBe('Bank of America')
    expect(id.accountType).toBe('checking')
    expect(id.lastFour).toBe('5678')
  })

  it('reads a credit card statement from its terms, not its brand', () => {
    const id = identifyStatementText([
      'Statement for account ending in 1234',
      'New Balance: $1,272.22',
      'Minimum Payment Due: $40.00',
      'Payment Due Date: 07/03/2026',
      'Credit Limit: $12,000',
    ])
    expect(id.accountType).toBe('credit')
    expect(id.lastFour).toBe('1234')
  })

  it('identifies Apple Card as a credit card by brand alone', () => {
    const id = identifyStatementText([
      'Apple Card Monthly Statement',
      'Total Balance $1,272.22 as of Jan 31, 2026',
    ])
    expect(id.institution).toBe('Apple Card')
    expect(id.accountType).toBe('credit')
  })

  it('identifies Apple Savings as savings, not Apple Card', () => {
    const id = identifyStatementText([
      'Apple Savings Statement',
      'Goldman Sachs Bank USA',
      'Interest earned this period: $12.40',
    ])
    expect(id.institution).toBe('Apple Savings')
    expect(id.accountType).toBe('savings')
  })

  it('finds a masked account number', () => {
    const id = identifyStatementText(['Account: XXXX-XXXX-XXXX-3477'])
    expect(id.lastFour).toBe('3477')
  })

  it('refuses to guess a contested type', () => {
    // savings vs checking dead heat — better to ask than to misfile
    const id = identifyStatementText([
      'Checking account statement',
      'Savings account statement',
    ])
    expect(id.accountType).toBeNull()
  })

  it('returns all nulls for an unrecognizable document', () => {
    const id = identifyStatementText(['hello world', 'nothing here'])
    expect(id).toEqual({ institution: null, accountType: null, lastFour: null })
  })

  it('does not read a transaction mention of a card payment as the account type', () => {
    // header region only: line 70+ noise must not vote (simulate a checking
    // statement whose txn rows mention CREDIT CARD PAYMENT)
    const header = [
      'First National Checking Account Summary',
      'Checks paid: 3',
    ]
    const txnNoise = Array.from({ length: 80 }, () => '06/01 CHASE CREDIT CARD PAYMENT 400.00')
    const id = identifyStatementText([...header, ...txnNoise])
    expect(id.accountType).toBe('checking')
  })
})

describe('identifyOFX', () => {
  it('reads type, last four, and org from a bank statement', () => {
    const id = identifyOFX(
      '<OFX><SIGNONMSGSRSV1><FI><ORG>Bank of America</ORG></FI></SIGNONMSGSRSV1>' +
        '<BANKMSGSRSV1><BANKACCTFROM><ACCTID>004460125678</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM></BANKMSGSRSV1></OFX>'
    )
    expect(id.institution).toBe('Bank of America')
    expect(id.accountType).toBe('checking')
    expect(id.lastFour).toBe('5678')
  })

  it('recognizes the credit-card message set', () => {
    const id = identifyOFX(
      '<OFX><CREDITCARDMSGSRSV1><CCACCTFROM><ACCTID>5412345678901234</ACCTID></CCACCTFROM></CREDITCARDMSGSRSV1></OFX>'
    )
    expect(id.accountType).toBe('credit')
    expect(id.lastFour).toBe('1234')
  })

  it('ignores an ORG that is just a routing code', () => {
    const id = identifyOFX('<OFX><FI><ORG>B1</ORG></FI><ACCTTYPE>SAVINGS</ACCTTYPE></OFX>')
    expect(id.institution).toBeNull()
    expect(id.accountType).toBe('savings')
  })
})

describe('identifyFilename', () => {
  it('reads bank and last four from a Chase export name', () => {
    const id = identifyFilename('Chase3477_Activity_20260601.CSV')
    expect(id.institution).toBe('Chase')
    expect(id.lastFour).toBe('3477')
  })

  it('does not mistake a statement date for a card number', () => {
    const id = identifyFilename('eStmt_2026-06-08.pdf')
    expect(id.lastFour).toBeNull()
  })

  it('does not read a bare year as a last four', () => {
    const id = identifyFilename('statement 2026.pdf')
    expect(id.lastFour).toBeNull()
  })

  it('recognizes squashed bank names', () => {
    expect(identifyFilename('bankofamerica_june.pdf').institution).toBe('Bank of America')
    expect(identifyFilename('AppleCard-Statement.pdf').institution).toBe('Apple Card')
  })
})

describe('mergeIdentities', () => {
  it('lets content win and filename fill the gaps', () => {
    const merged = mergeIdentities(
      { institution: null, accountType: 'credit', lastFour: null },
      { institution: 'Chase', accountType: null, lastFour: '3477' }
    )
    expect(merged).toEqual({ institution: 'Chase', accountType: 'credit', lastFour: '3477' })
  })
})

describe('suggestedAccountName', () => {
  it('composes institution, type, and last four', () => {
    expect(
      suggestedAccountName({ institution: 'Capital One', accountType: 'credit', lastFour: '1234' })
    ).toBe('Capital One Credit Card ••1234')
  })

  it('skips a type word the brand already carries', () => {
    expect(
      suggestedAccountName({ institution: 'Apple Card', accountType: 'credit', lastFour: null })
    ).toBe('Apple Card')
    expect(
      suggestedAccountName({ institution: 'Apple Savings', accountType: 'savings', lastFour: null })
    ).toBe('Apple Savings')
  })

  it('returns empty when nothing was identified', () => {
    expect(
      suggestedAccountName({ institution: null, accountType: null, lastFour: null })
    ).toBe('')
  })
})
