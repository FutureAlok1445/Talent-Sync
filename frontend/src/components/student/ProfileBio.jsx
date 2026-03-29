/*
 * WHO WRITES THIS: Frontend developer
 * WHAT THIS DOES: Bio subsection — textarea with live character counter,
 *                 max 406 chars, counter turns red above 380.
 * DEPENDS ON: useProfileForm state
 */
const MAX_BIO = 406
const WARN_THRESHOLD = 380

export default function ProfileBio({ bio, setBio, saving, error, onSave }) {
  const charCount = bio.length
  const isWarn = charCount > WARN_THRESHOLD

  return (
    <div className="card-base" id="profile-bio">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-[3px] border-2 border-ink bg-yellow text-sm font-bold shadow-[2px_2px_0_var(--border)]">
          2
        </span>
        <h2 className="text-xl font-bold text-ink">Bio</h2>
      </div>

      <div className="relative">
        <textarea
          value={bio}
          onChange={(e) => {
            if (e.target.value.length <= MAX_BIO) {
              setBio(e.target.value)
            }
          }}
          placeholder="Tell recruiters a bit about yourself..."
          maxLength={MAX_BIO}
          rows={5}
          className="input-brutal resize-none"
          style={{ minHeight: '130px' }}
        />
        <span
          className={`absolute bottom-3 right-3 font-mono text-xs transition-colors ${
            isWarn ? 'font-bold text-red-600' : 'text-ink/50'
          }`}
        >
          {charCount} / {MAX_BIO}
        </span>
      </div>

      {error && (
        <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="btn-primary btn-feedback"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
