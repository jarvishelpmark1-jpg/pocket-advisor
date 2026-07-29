import { describe, it, expect } from 'vitest'
import { buildBriefing, type AdvisorParagraph, type BriefingInput, type MonthRow } from './advisor'

function month(m: string, income: number, expenses: number, categories: Record<string, number> = {}): MonthRow {
  return { month: m, income, expenses, net: income - expenses, categories }
}

function input(over: Partial<BriefingInput> = {}): BriefingInput {
  return {
    rangeLabel: 'the last year',
    months: [
      month('2026-01', 8000, 6000),
      month('2026-02', 8200, 6100),
      month('2026-03', 8400, 6300),
      month('2026-04', 8600, 6200),
      month('2026-05', 9000, 6400),
      month('2026-06', 9200, 6300),
    ],
    netWorthStart: 50000,
    netWorthNow: 62000,
    liquidBalance: 40000,
    cardDebt: 0,
    cardCarriesInterest: false,
    loanDebt: 250000,
    incomeSources: [
      { source: 'Business', total: 30000 },
      { source: 'Payroll', total: 15000 },
      { source: 'Interest', total: 400 },
    ],
    dataIssueCount: 0,
    ...over,
  }
}

const byId = (ps: AdvisorParagraph[], id: string) => ps.find((p) => p.id === id)

describe('buildBriefing', () => {
  it('opens with the net-worth story and ends with exactly one move', () => {
    const ps = buildBriefing(input())
    expect(ps[0].id).toBe('opening')
    expect(ps[0].text).toContain('in the right direction')
    expect(ps[ps.length - 1].id).toBe('closing-move')
    expect(ps.filter((p) => p.id === 'closing-move')).toHaveLength(1)
  })

  it('celebrates a 20%+ keep rate like an advisor would', () => {
    const ps = buildBriefing(input())
    const keep = byId(ps, 'keep-rate')
    expect(keep?.tone).toBe('win')
    expect(keep?.text).toMatch(/kept 2\d% of everything/)
  })

  it('treats interest-charging card debt as the emergency and aims the move at it', () => {
    const ps = buildBriefing(input({ cardDebt: 6200, cardCarriesInterest: true }))
    expect(byId(ps, 'card-debt')?.text).toContain('ahead of the house fund')
    expect(byId(ps, 'closing-move')?.text).toContain('cards')
  })

  it('never lectures a transactor — a full-autopay balance is float, not debt', () => {
    const ps = buildBriefing(input({ cardDebt: 4272, cardCarriesInterest: false }))
    expect(byId(ps, 'card-debt')).toBeUndefined()
    expect(byId(ps, 'closing-move')?.text).not.toContain('cards')
    expect(byId(ps, 'card-float')?.text).toContain('float, not debt')
  })

  it('aims the closing move at the cushion when cards are clear but runway is thin', () => {
    const ps = buildBriefing(input({ liquidBalance: 9000 }))
    expect(byId(ps, 'closing-move')?.text).toContain('cushion')
    expect(byId(ps, 'runway')?.text).toContain('six months')
  })

  it('sweeps surplus toward the house when cards are clear and runway is solid', () => {
    const ps = buildBriefing(input())
    expect(byId(ps, 'closing-move')?.text).toContain('house fund')
  })

  it('tells the truth at break-even and points the move at income', () => {
    const months = Array.from({ length: 6 }, (_, i) => month(`2026-0${i + 1}`, 7000, 7000))
    const ps = buildBriefing(input({ months, netWorthStart: 50000, netWorthNow: 49000, liquidBalance: 60000 }))
    expect(byId(ps, 'opening')?.text).toContain('Straight talk')
    expect(byId(ps, 'keep-rate')?.tone).toBe('watch')
    expect(byId(ps, 'closing-move')?.text).toContain('income')
  })

  it('leads with the data caveat when accounts are behind', () => {
    const ps = buildBriefing(input({ dataIssueCount: 2 }))
    expect(ps[0].id).toBe('caveat')
    expect(ps[0].text).toContain('partial picture')
    expect(ps[1].id).toBe('opening')
  })

  it('flags income concentration at 70%+ from one source', () => {
    const ps = buildBriefing(
      input({ incomeSources: [{ source: 'Business', total: 45000 }, { source: 'Interest', total: 300 }] })
    )
    expect(byId(ps, 'income-concentration')?.text).toContain('Business')
  })

  it('names a category that drifted up between halves of the period', () => {
    const months = [
      month('2026-01', 8000, 6000, { dining: 200 }),
      month('2026-02', 8000, 6000, { dining: 220 }),
      month('2026-03', 8000, 6000, { dining: 210 }),
      month('2026-04', 8000, 6400, { dining: 480 }),
      month('2026-05', 8000, 6500, { dining: 520 }),
      month('2026-06', 8000, 6500, { dining: 500 }),
    ]
    const ps = buildBriefing(input({ months }))
    const drift = byId(ps, 'drift-dining')
    expect(drift?.text).toContain('dining')
    expect(drift?.text).toContain('If that’s deliberate, fine')
  })

  it('notices income running hotter in the back half', () => {
    const months = [
      month('2026-01', 6000, 5000),
      month('2026-02', 6200, 5000),
      month('2026-03', 6100, 5000),
      month('2026-04', 7500, 5000),
      month('2026-05', 7800, 5000),
      month('2026-06', 8000, 5000),
    ]
    const ps = buildBriefing(input({ months }))
    expect(byId(ps, 'income-growth')?.text).toContain('growth engine')
  })

  it('keeps the briefing tight — opening + at most 4 body paragraphs + one move', () => {
    const ps = buildBriefing(input({ cardDebt: 5000, cardCarriesInterest: true, dataIssueCount: 1 }))
    // caveat + opening + ≤4 body + closing
    expect(ps.length).toBeLessThanOrEqual(7)
  })

  it('never nags about lattes', () => {
    const ps = buildBriefing(input())
    expect(ps.map((p) => p.text).join(' ')).not.toMatch(/latte|coffee/i)
  })
})
