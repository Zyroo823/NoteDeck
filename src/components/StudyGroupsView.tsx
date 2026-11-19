import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Copy, KeyRound, Plus, RefreshCw, UsersRound } from "lucide-react";
import { ConfirmDialog } from "@/src/components/ConfirmDialog";
import type { StudyGroupDetail, StudyGroupSummary } from "@/src/types/api";

const groupsApi = "/api/study-groups";
const surface = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-[#141926]";
const muted = "text-sm leading-relaxed text-slate-600 dark:text-slate-400";
const field = "min-h-11 min-w-0 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-[#0B0E17]";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#494bd2] px-4 text-sm font-semibold text-white hover:bg-[#3739aa] disabled:opacity-60";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-[#1C2336]";

async function requestGroups<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? "Could not complete the study group request. Try again.");
  }
  return res.json() as Promise<T>;
}

function GroupError({ message }: { message: string }) {
  return <p role="alert" className="text-sm text-red-700 dark:text-red-300">{message}</p>;
}

function memberCount(count: number) {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

export function StudyGroupsView({ onOpenGroup }: { onOpenGroup: (id: string) => void }) {
  const [groups, setGroups] = useState<StudyGroupSummary[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState<"create" | "join" | null>(null);
  const [formError, setFormError] = useState<{ action: "create" | "join"; message: string }>();
  const mutation = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoadError("");
    void requestGroups<{ groups: StudyGroupSummary[] }>(groupsApi, { signal }).then(({ groups }) => {
      if (!signal.aborted) setGroups(groups);
    }).catch(() => {
      if (!signal.aborted) setLoadError("Could not load your study groups.");
    });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => () => mutation.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>, action: "create" | "join") {
    event.preventDefault();
    if (mutation.current) return;
    const data = new FormData(event.currentTarget);
    const payload = action === "create" ? { name: data.get("name") } : { code: data.get("code") };
    const controller = new AbortController();
    const { signal } = controller;
    mutation.current = controller;
    setPending(action);
    setFormError(undefined);
    try {
      const { groupId } = await requestGroups<{ groupId: string }>(action === "create" ? groupsApi : `${groupsApi}/join`, {
        method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!signal.aborted) onOpenGroup(groupId);
    } catch (error) {
      if (!signal.aborted) setFormError({ action, message: error instanceof Error ? error.message : "Try again." });
    } finally {
      if (!signal.aborted) setPending(null);
      if (mutation.current === controller) mutation.current = null;
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Study groups</h1>
        <p className={`mt-1 ${muted}`}>Create a group for your class or join your friends with an invite code.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={(event) => void submit(event, "create")} className={`${surface} space-y-3`}>
          <h2 className="flex items-center gap-2 font-semibold"><UsersRound aria-hidden="true" className="size-5 text-indigo-600 dark:text-indigo-300" /> Create a group</h2>
          <label htmlFor="study-group-name" className="block text-sm font-medium">Group name</label>
          <input id="study-group-name" name="name" required minLength={2} maxLength={60} placeholder="e.g. Biology review" className={`${field} w-full`} />
          {formError?.action === "create" && <GroupError message={formError.message} />}
          <button type="submit" disabled={pending !== null} className={primary}>
            <Plus aria-hidden="true" className="size-4" /> {pending === "create" ? "Creating…" : "Create group"}
          </button>
        </form>

        <form onSubmit={(event) => void submit(event, "join")} className={`${surface} space-y-3`}>
          <h2 className="flex items-center gap-2 font-semibold"><KeyRound aria-hidden="true" className="size-5 text-indigo-600 dark:text-indigo-300" /> Join with a code</h2>
          <label htmlFor="study-group-invite" className="block text-sm font-medium">Invite code</label>
          <input id="study-group-invite" name="code" required maxLength={40} autoComplete="off" autoCapitalize="characters" spellCheck={false}
            placeholder="Enter the code from your friend" className={`${field} w-full`} />
          {formError?.action === "join" && <GroupError message={formError.message} />}
          <button type="submit" disabled={pending !== null} className={secondary}>
            {pending === "join" ? "Joining…" : "Join group"} <ArrowRight aria-hidden="true" className="size-4" />
          </button>
        </form>
      </div>

      <section aria-labelledby="my-study-groups" className="space-y-3">
        <h2 id="my-study-groups" className="text-lg font-semibold">Your groups</h2>
        {loadError ? (
          <div className="space-y-2">
            <GroupError message={loadError} />
            <button type="button" className={secondary} onClick={() => setRetry((value) => value + 1)}>Try again</button>
          </div>
        ) : null}
        {!loadError && groups === null && <p role="status" className={muted}>Loading groups…</p>}
        {groups?.length === 0 && <p className={`${surface} ${muted}`}>You haven’t joined any groups yet.</p>}
        {groups && groups.length > 0 && (
          <ul className="grid gap-3 lg:grid-cols-2">
            {groups.map((group) => (
              <li key={group.id}>
                <button type="button" onClick={() => onOpenGroup(group.id)} className={`${surface} flex w-full items-center gap-3 text-left hover:border-indigo-400 dark:hover:border-indigo-500`}>
                  <UsersRound aria-hidden="true" className="size-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-semibold">{group.name}</span>
                    <span className={muted}>{memberCount(group.memberCount)} · {group.isOwner ? "Owner" : "Member"}</span>
                  </span>
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className={`${surface} group`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-sm font-semibold [&::-webkit-details-marker]:hidden">
          Learn more about study groups <ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open:rotate-180" />
        </summary>
        <ul className={`mt-3 list-disc space-y-2 pl-5 ${muted}`}>
          <li>Create a group and share its invite code privately with your friends.</li>
          <li>Friends sign in to NoteDeck, open Study groups, and enter the code under Join with a code.</li>
          <li>Members see the group name and each other’s display names. Personal flashcards and study guides stay in each member’s library.</li>
          <li>The owner can reset the code to stop old invitations or delete the group. Members can leave at any time.</li>
        </ul>
      </details>
    </div>
  );
}

export function StudyGroupView({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const [group, setGroup] = useState<StudyGroupDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [confirmation, setConfirmation] = useState<"reset" | "remove" | null>(null);
  const [pending, setPending] = useState(false);
  const mutation = useRef<AbortController | null>(null);
  const codeField = useRef<HTMLInputElement>(null);
  const url = `${groupsApi}/${encodeURIComponent(groupId)}`;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError("");
    void requestGroups<{ group: StudyGroupDetail }>(url, { signal }).then(({ group }) => {
      if (!signal.aborted) setGroup(group);
    }).catch((error: unknown) => {
      if (!signal.aborted) {
        setGroup(undefined);
        setError(error instanceof Error ? error.message : "Could not load this study group.");
      }
    }).finally(() => {
      if (!signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [url, refresh]);

  useEffect(() => () => mutation.current?.abort(), []);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice("Invite code copied.");
    } catch {
      codeField.current?.focus();
      codeField.current?.select();
      setNotice("The code is selected. Copy it to share with your friends.");
    }
  }

  async function confirmChange() {
    if (!confirmation || !group || mutation.current) return;
    const controller = new AbortController();
    const { signal } = controller;
    mutation.current = controller;
    setPending(true);
    setError("");
    setNotice("");
    try {
      if (confirmation === "reset") {
        const { group: updated } = await requestGroups<{ group: StudyGroupDetail }>(`${url}/invite-code`, { method: "POST", signal });
        if (!signal.aborted) {
          setGroup(updated);
          setNotice("New invite code ready to share.");
        }
      } else {
        const res = await fetch(group.isOwner ? url : `${url}/membership`, { method: "DELETE", signal });
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(data.error ?? "Could not update this study group.");
        }
        if (!signal.aborted) onBack();
      }
    } catch (error) {
      if (!signal.aborted) setError(error instanceof Error ? error.message : "Try again.");
    } finally {
      if (!signal.aborted) {
        setPending(false);
        setConfirmation(null);
      }
      if (mutation.current === controller) mutation.current = null;
    }
  }

  const removeLabel = group?.isOwner ? "Delete group" : "Leave group";
  const inviteCode = group?.inviteCode;

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
        <ArrowLeft aria-hidden="true" className="size-4" /> Study groups
      </button>
      {error && <GroupError message={error} />}
      {!group && loading && <p role="status" className={muted}>Loading study group…</p>}
      {!group && !loading && <button type="button" onClick={() => setRefresh((value) => value + 1)} className={secondary}>Try again</button>}

      {group && (
        <>
          <h1 className="break-words text-2xl font-bold tracking-tight">{group.name}</h1>

          {inviteCode && (
            <section aria-labelledby="invite-friends" className={`${surface} space-y-3`}>
              <h2 id="invite-friends" className="text-lg font-semibold">Invite friends</h2>
              <p className={muted}>Share this code with friends to let them join this group.</p>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={codeField} aria-label="Group invite code" readOnly value={inviteCode.match(/.{4}/g)?.join("-") ?? inviteCode}
                  className={`${field} flex-1 basis-44 font-mono tracking-wide sm:max-w-64`} />
                <button type="button" onClick={() => void copyCode(inviteCode)} className={primary}>
                  <Copy aria-hidden="true" className="size-4" /> Copy code
                </button>
                <button type="button" disabled={loading || pending} onClick={() => setConfirmation("reset")} className={secondary}>Reset code</button>
              </div>
              {notice && <p role="status" className={muted}>{notice}</p>}
            </section>
          )}

          <section aria-labelledby="group-members" className={`${surface} space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="group-members" className="text-lg font-semibold">Members <span className={muted}>({group.members.length})</span></h2>
              <button type="button" disabled={loading || pending} onClick={() => setRefresh((value) => value + 1)} className={secondary}>
                <RefreshCw aria-hidden="true" className="size-4" /> {loading ? "Refreshing…" : "Refresh members"}
              </button>
            </div>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {group.members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 break-words">{member.name}</span>
                  <span className="shrink-0 text-xs text-slate-600 dark:text-slate-400">{member.isOwner ? "Owner" : "Member"}</span>
                </li>
              ))}
            </ul>
          </section>

          <button type="button" disabled={loading || pending} onClick={() => setConfirmation("remove")}
            className="min-h-11 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950/40">{removeLabel}</button>

          <ConfirmDialog open={confirmation !== null} loading={pending}
            loadingLabel={confirmation === "reset" ? "Resetting…" : group.isOwner ? "Deleting…" : "Leaving…"}
            title={confirmation === "reset" ? "Reset invite code?" : `${removeLabel}?`}
            message={confirmation === "reset" ? "The current code will stop working. Existing members will stay in the group."
              : group.isOwner ? "This removes the group for everyone who joined." : "You’ll need a valid invite code to join again."}
            confirmLabel={confirmation === "reset" ? "Reset code" : removeLabel}
            onConfirm={() => void confirmChange()} onCancel={() => setConfirmation(null)} />
        </>
      )}
    </div>
  );
}
