import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useBusinessUnitContext } from "../context/BusinessUnitContext";
import { NameInput, PhoneInput } from "../components/FormattedInputs";

// "My Profile" — personal details, separate from Account & Security
// (which stays 2FA/login-only). Self-service: full name, phone, date
// of birth, and an optional photo. Whether a photo can be uploaded at
// all is a per-business-unit choice (allow_profile_photos — see
// supabase/migrations/0007_user_profiles.sql and BusinessUnitDetail's
// Branding section), so this page checks the signed-in person's own
// unit before offering the upload control at all.
//
// Contact visibility (whether phone/email show up to colleagues in
// the Team directory) is deliberately NOT editable here — that's an
// admin-controlled flag, set per person in System Settings -> User
// Management -> Team Members, not something someone can switch on for
// themselves.
export function Profile() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const { headOffice, units } = useBusinessUnitContext();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setDob(profile.date_of_birth ?? "");
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  // A Head Office-scoped person (business_unit_id null) doesn't
  // belong to a specific subsidiary unit — Head Office's own setting
  // applies to them, same reasoning as branding falling back to Head
  // Office. A unit-scoped person's own unit setting applies.
  const myUnit = profile?.business_unit_id ? units.find((u) => u.id === profile.business_unit_id) : headOffice;
  const photosAllowed = myUnit?.allow_profile_photos ?? true;

  async function handlePhotoUpload(file: File) {
    if (!profile) return;
    setUploadingPhoto(true);
    setError(null);
    const path = `${profile.id}-${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadErr) {
      setError(uploadErr.message);
    } else {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    }
    setUploadingPhoto(false);
  }

  async function handleSave() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || profile.full_name,
        phone: phone.trim() || null,
        date_of_birth: dob || null,
        avatar_url: avatarUrl,
      })
      .eq("id", profile.id);
    if (err) {
      setError(err.message);
    } else {
      setMessage("Saved.");
      await refreshProfile();
      setTimeout(() => setMessage(null), 2500);
    }
    setBusy(false);
  }

  if (!profile) {
    return <div className="text-sm text-ink-muted">Loading…</div>;
  }

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Your own details — visible to you and, where enabled, to colleagues in the Team directory."
        back={{ label: "Back", onClick: () => navigate("/") }}
      />

      {message && <div className="rounded-lg bg-green-50 dark:bg-green-900/30 px-4 py-2 text-sm text-green-700 dark:text-green-300">{message}</div>}
      {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <section className="card space-y-4 p-6">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/10 text-xl font-semibold text-brand-primary">
              {(fullName || profile.email).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            {photosAllowed ? (
              <>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingPhoto}
                  onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                />
                <p className="mt-1 text-xs text-ink-muted">{uploadingPhoto ? "Uploading…" : "JPG or PNG, shown across the system."}</p>
              </>
            ) : (
              <p className="text-xs text-ink-muted">Profile photos aren't enabled for your business unit.</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Full name</label>
            <NameInput value={fullName} onChange={(v) => setFullName(v)} person />
          </div>
          <div>
            <label className="label">Email</label>
            <div className="input flex cursor-not-allowed items-center bg-surface-muted text-ink-muted">{profile.email}</div>
          </div>
          <div>
            <label className="label">Phone number</label>
            <PhoneInput value={phone} onChange={(v) => setPhone(v)} />
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input type="date" className="input" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
        </div>

        <button className="btn-primary" disabled={busy} onClick={handleSave}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </section>
    </div>
  );
}
