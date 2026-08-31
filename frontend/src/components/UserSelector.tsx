"use client";

import { USER_IDS } from "@/lib/hooks";

export default function UserSelector({
  user,
  onChange,
}: {
  user: string;
  onChange: (user: string) => void;
}) {
  return (
    <label className="user-selector">
      <span className="field-label">Active user (X-User-ID)</span>
      <select
        aria-label="Active user"
        value={user}
        onChange={(event) => onChange(event.target.value)}
      >
        {USER_IDS.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
      <span className="hint">Development identity — no authentication in this phase.</span>
    </label>
  );
}
