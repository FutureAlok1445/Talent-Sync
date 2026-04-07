/*
 * WHO WRITES THIS: Frontend developer
 * WHAT THIS DOES: Horizontal waterfall bar chart showing SHAP feature
 *                 contributions. Positive = yellow bar right. Negative = pink bar left.
 *                 Bars animate from 0 to final width on mount.
 *                 Shows final score at bottom.
 * DEPENDS ON: formatters.js (scoreToPercent, getMatchColor, formatFeatureLabel)
 * PROPS: shapValues (object), totalScore (float 0-1)
 */
import { formatFeatureLabel, getMatchColor, scoreToPercent } from '../../utils/formatters'
import { memo, useMemo } from 'react'

const MAX_VISIBLE_FACTORS = 10
const MIN_VISIBLE_IMPACT = 0.01

function SHAPChart({ shapValues = {}, totalScore = 0 }) {
  const entries = useMemo(
    () => Object.entries(shapValues || {})
      .map(([feature, value]) => [feature, Number(value) || 0])
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])),
    [shapValues]
  )

  const visibleEntries = useMemo(() => {
    const impactful = entries.filter(([, value]) => Math.abs(Number(value) || 0) >= MIN_VISIBLE_IMPACT)
    const source = impactful.length ? impactful : entries
    return source.slice(0, MAX_VISIBLE_FACTORS)
  }, [entries])

  const maxAbs = useMemo(
    () => visibleEntries.reduce((max, [, value]) => Math.max(max, Math.abs(Number(value) || 0)), 0.001),
    [visibleEntries]
  )

  return (
    <div className="rounded-lg border border-(--border) bg-(--bg-card) p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-[13px] font-bold uppercase tracking-wider text-(--text-primary)">Match Reasoning</h3>
        <span className="font-mono text-[10px] font-bold text-(--text-muted)">FACTOR IMPACT</span>
      </div>
      <p className="mb-5 text-[12px] leading-relaxed text-(--text-secondary)">Longer bars indicate stronger model-side influence. Final match score is blended with skills-first policy and semantic alignment.</p>

      {visibleEntries.length === 0 ? (
        <p className="text-sm text-ink/70">No explainability data available yet.</p>
      ) : (
        <div className="space-y-2">
          {visibleEntries.map(([feature, value], index) => {
            const numeric = Number(value) || 0
            const width = `${Math.max(6, (Math.abs(numeric) / maxAbs) * 100)}%`
            const positive = numeric >= 0
            const isTop = index < 2
            return (
              <div key={feature} className="space-y-1.5 flex flex-col">
                <div className="flex items-center justify-between text-[12px] text-(--text-secondary)">
                  <span className={isTop ? 'font-semibold text-(--text-primary)' : ''}>{formatFeatureLabel(feature)}</span>
                  <span className="font-mono text-[11px] font-medium">{positive ? '+' : ''}{numeric.toFixed(2)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-(--bg-subtle)">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${positive ? 'bg-(--accent-yellow)' : 'bg-(--danger)'}`}
                    style={{ width }}
                  />
                </div>
              </div>
            )
          })}
          {entries.length > visibleEntries.length ? (
            <p className="pt-1 text-[11px] text-(--text-muted)">Showing top {MAX_VISIBLE_FACTORS} most impactful factors.</p>
          ) : null}
        </div>
      )}

      <div className="mt-6 border-t border-(--border) pt-4 text-[13px] font-medium text-(--text-secondary)">
        Calculated alignment: <span className="font-bold font-mono" style={{ color: getMatchColor(totalScore) }}>{scoreToPercent(totalScore)}</span>
      </div>
    </div>
  )
}

export default memo(SHAPChart)