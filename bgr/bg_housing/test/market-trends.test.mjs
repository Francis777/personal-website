import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMarketTrendCore, quarterFromIsoDate } from '../src/marketTrendsCore.mjs'

const asking = (recordDateIso, eurSqm, city = 'Sofia') => ({ city, recordDateIso, eurSqm })
const sold = (quarter, index, city = 'Sofia') => ({ city, quarter, index })

test('listing dates are bucketed on exact quarter boundaries and invalid dates fail closed', () => {
  assert.equal(quarterFromIsoDate('2026-03-31'), '2026 Q1')
  assert.equal(quarterFromIsoDate('2026-04-01'), '2026 Q2')
  assert.equal(quarterFromIsoDate('2026-06-30'), '2026 Q2')
  assert.equal(quarterFromIsoDate('2026-07-01'), '2026 Q3')
  assert.equal(quarterFromIsoDate('2026-02-31'), null)
  assert.equal(quarterFromIsoDate('2026-Q1'), null)
})

test('trend helper calculates odd and even medians, filters by city, and rebases on the first shared point', () => {
  const trend = buildMarketTrendCore(
    [
      asking('2026-01-01', 900), asking('2026-02-01', 1_000), asking('2026-03-31', 1_100),
      asking('2026-04-01', 1_200), asking('2026-06-30', 1_800),
      asking('2026-02-01', 9_000, 'Plovdiv'),
    ],
    [sold('2026 Q1', 100), sold('2026 Q2', 110), sold('2026 Q1', 500, 'Plovdiv')],
    'Sofia',
    ['2026 Q1', '2026 Q2'],
    2,
  )

  assert.equal(trend.baselineQuarter, '2026 Q1')
  assert.deepEqual(trend.points.map((point) => ({
    quarter: point.quarter,
    hpi: point.soldHpi,
    asking: point.askingMedianEurSqm,
    count: point.askingSampleSize,
    hpiComparable: point.soldComparableIndex === null ? null : Number(point.soldComparableIndex.toFixed(6)),
    askingComparable: point.askingComparableIndex === null ? null : Number(point.askingComparableIndex.toFixed(6)),
  })), [
    { quarter: '2026 Q1', hpi: 100, asking: 1_000, count: 3, hpiComparable: 100, askingComparable: 100 },
    { quarter: '2026 Q2', hpi: 110, asking: 1_500, count: 2, hpiComparable: 110, askingComparable: 150 },
  ])
})

test('minimum sample suppresses sparse asking points without forward filling', () => {
  const trend = buildMarketTrendCore(
    [asking('2026-01-01', 1_000), asking('2026-04-01', 1_500)],
    [sold('2026 Q1', 100), sold('2026 Q2', 105)],
    'Sofia',
    ['2026 Q1', '2026 Q2'],
    2,
  )

  assert.equal(trend.baselineQuarter, null)
  assert.deepEqual(trend.points.map((point) => [
    point.askingMedianEurSqm,
    point.askingSampleSize,
    point.soldComparableIndex,
    point.askingComparableIndex,
  ]), [
    [null, 1, null, null],
    [null, 1, null, null],
  ])
})

test('invalid or non-positive unit prices and sold indices do not enter the series', () => {
  const trend = buildMarketTrendCore(
    [asking('2026-01-01', 0), asking('bad-date', 1_000), asking('2026-01-02', Number.NaN)],
    [sold('2026 Q1', -1)],
    'Sofia',
    ['2026 Q1'],
    1,
  )
  assert.deepEqual(trend.points[0], {
    quarter: '2026 Q1',
    soldHpi: null,
    askingMedianEurSqm: null,
    askingSampleSize: 0,
    soldComparableIndex: null,
    askingComparableIndex: null,
  })
})
