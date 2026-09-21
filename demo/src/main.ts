import { typedToEntries } from "niall-utils/data";

import {
  buttonParser,
  checkboxParser,
  colorParser,
  createParsers,
  datetimeParser,
  dependency,
  derived,
  equals,
  fileParser,
  groupParser,
  ifParser,
  listParser,
  numberParser,
  rangeParser,
  satisfies,
  selectParser,
  SeriForm,
  tableParser,
  textParser,
  unless,
  when,
  type ResolvedParserObject,
} from "../../src/index.ts";

const config = createParsers({
  "project-name": textParser({
    label: "Project name",
    default: "Aurora",
    attrs: { placeholder: "What are you launching?" },
  }),
  description: textParser({
    label: "Description",
    default: "A shareable config editor built with Seriform.",
    area: true,
    attrs: { placeholder: "One or two sentences…" },
  }),
  visibility: selectParser({
    label: "Visibility",
    default: "internal",
    options: ["private", "internal", "public"],
  }),
  "launch-date": datetimeParser({
    label: "Launch date",
    default: new Date("2026-10-01T09:00Z"),
  }),
  "is-public": checkboxParser({
    label: "Publish immediately",
    title: "Skip the internal review stage",
    default: false,
  }),
  "accent-color": colorParser({
    label: "Accent color",
    default: "6366f1",
  }),
  capacity: rangeParser({
    label: "Capacity",
    default: 100,
    attrs: { min: "0", max: "500", step: "10" },
  }),
  "max-retries": numberParser({
    label: "Max retries",
    default: 3,
    attrs: { min: "0", max: "10" },
  }),
  logo: fileParser({
    text: "Upload logo",
    attrs: { accept: "image/*" },
  }),
  notify: buttonParser({
    text: "Send test notification",
    attrs: { class: "primary wrap-text" },
  }),
  owner: groupParser({
    label: "Owner",
    title: "Who's responsible for this launch",
    children: {
      name: textParser({ label: "Name", default: "" }),
      email: textParser({ label: "Email", default: "" }),
      "is-admin": checkboxParser({ label: "Admin access", default: true }),
      "public-note": when({
        condition: equals(["..", "visibility"], "public"),
        label: "Public launch note",
        title:
          "Shown only while the root-level visibility field is 'public' — reaches out of this group via '..'",
        parser: textParser({
          default: "Owner is on call for the first hour after launch.",
        }),
      }),
    },
  }),
  team: tableParser({
    label: "Team",
    expandable: true,
    fields: [
      textParser({ label: "Name" }),
      selectParser({
        label: "Role",
        default: "Editor",
        options: ["Admin", "Editor", "Viewer"],
      }),
      checkboxParser({ label: "Active", default: true }),
    ],
    default: [
      ["Ada Lovelace", "Admin", true],
      ["Alan Turing", "Editor", true],
    ],
  }),
  "team-lead-warning": when({
    condition: satisfies(
      ["team", 0, 2],
      (active: boolean | undefined) => active !== true
    ),
    label: "Team lead inactive",
    title:
      "Depends on team[0]'s Active column — a fixed-width column inside a table row is always a definite type, even though the row array itself is dynamic",
    parser: textParser({
      default: "⚠️ The first team member is marked inactive.",
    }),
  }),
  tags: listParser({
    label: "Tags",
    expandable: true,
    field: textParser({ default: "" }),
    default: ["beta", "internal"],
  }),
  "third-tag-note": when({
    condition: satisfies(["tags", 2], (tag: string | undefined) => tag != null),
    label: "Third tag",
    title:
      "Depends on tags[2] — a list's items are a dynamic array, so this dependency's type must be widened to `string | undefined` to account for there being fewer than 3 tags",
    parser: textParser({ default: "Consider trimming down to 2 tags." }),
  }),
  announcement: when({
    condition: equals(["visibility"], "public"),
    label: "Announcement text",
    title: "Shown only while visibility is 'public'",
    parser: textParser({
      default: "We're live! Come take a look.",
      area: true,
    }),
  }),
  "invite-limit": unless({
    condition: equals(["is-public"], true),
    label: "Invite limit",
    title: "Hidden once the project is public",
    parser: numberParser({ default: 25, attrs: { min: "0", max: "1000" } }),
  }),
  "status-message": ifParser({
    label: "Status message",
    title: "First matching branch wins",
    branches: [
      {
        condition: derived(
          visibility => visibility === "internal",
          [dependency<"private" | "internal" | "public">()("visibility")]
        ),
        parser: textParser({ default: "Visible to the team only." }),
      },
      {
        condition: derived(
          isPublic => isPublic,
          [dependency<boolean>()("is-public")]
        ),
        parser: textParser({ default: "Announced to everyone." }),
      },
    ],
    otherwise: textParser({ default: "Draft — not yet shared." }),
  }),
});

export type Config =
  typeof config extends ResolvedParserObject<infer R> ? R : never;

const configEl = document.getElementById("config-ui") as HTMLElement;
const valuesOutputEl = document.getElementById("values-output") as HTMLElement;
const urlOutputEl = document.getElementById("url-output") as HTMLElement;
const shareStatusEl = document.getElementById("share-status") as HTMLElement;
const toastEl = document.getElementById("toast") as HTMLElement;
const shortUrlToggleEl = document.getElementById(
  "short-url-toggle"
) as HTMLInputElement;
const root = document.documentElement;

// Plain HTML, not a Seriform field - it decides which mode to build the *main* form in,
// so it can't be one of that form's own fields. Its own state rides along in the share
// URL as a plain "s" param instead, so a shared short-url link re-decodes itself.
shortUrlToggleEl.checked =
  new URLSearchParams(location.search).get("s") != null;

// Reassigned on every remount (see `mount` below), so listeners that close over it -
// the share button's click handler included - always act on the current form. Null only
// before the very first `mount` call.
let seriform: SeriForm<Config> | null = null;

const buildShareUrl = (): string => {
  const query = [
    shortUrlToggleEl.checked ? "s" : "",
    seriform?.serialiseToUrlParams() ?? "",
  ]
    .filter(part => part.length > 0)
    .join("&");

  return `${location.origin}${location.pathname}${
    query.length > 0 ? `?${query}` : ""
  }`;
};

let toastTimer: number | undefined;
const showToast = (message: string): void => {
  toastEl.textContent = message;
  toastEl.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
};

// `shortUrl` can only be set at construction time, so toggling it re-mounts the whole
// form. The very first mount reads `location.search` as usual; every mount after that
// carries the outgoing form's live values across instead, so toggling mid-edit doesn't
// throw away unsaved changes by falling back to whatever was in the URL on page load.
const mount = (shortUrl: boolean): void => {
  const previousValues = seriform?.getAllValues() ?? null;

  configEl.innerHTML = "";
  const form = new SeriForm(
    config,
    configEl,
    shortUrl
      ? {
          query: previousValues == null ? location.search : "",
          shortUrl: true,
          hashLength: 2,
        }
      : { query: previousValues == null ? location.search : "" }
  );
  seriform = form;

  if (previousValues != null) {
    typedToEntries(previousValues).forEach(([id, value]) => {
      form.setValue(id, value);
    });
  }

  form.addListener(() => {
    valuesOutputEl.textContent = JSON.stringify(form.getAllValues(), null, 2);
    urlOutputEl.textContent = buildShareUrl();
  });

  form.addListener(
    values => {
      root.style.setProperty("--accent", `#${values["accent-color"]}`);
    },
    ["accent-color"]
  );

  form.addListener(() => {
    showToast("Notification sent (this is just a demo — nothing was sent).");
  }, ["notify"]);

  root.style.setProperty("--accent", `#${form.getValue("accent-color")}`);
  valuesOutputEl.textContent = JSON.stringify(form.getAllValues(), null, 2);
  urlOutputEl.textContent = buildShareUrl();
};

let shareTimer: number | undefined;
document.getElementById("share-button")?.addEventListener("click", () => {
  void navigator.clipboard.writeText(buildShareUrl());

  shareStatusEl.hidden = false;
  window.clearTimeout(shareTimer);
  shareTimer = window.setTimeout(() => {
    shareStatusEl.hidden = true;
  }, 1800);
});

shortUrlToggleEl.addEventListener("change", () => {
  mount(shortUrlToggleEl.checked);
});

mount(shortUrlToggleEl.checked);
