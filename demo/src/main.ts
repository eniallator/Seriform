import { typedToEntries } from "niall-utils/data";
import { debounce } from "niall-utils/timing";
import { dom } from "niall-utils/ui";

import {
  buttonContent,
  checkboxParser,
  colorParser,
  createParsers,
  datetimeParser,
  dependency,
  derived,
  dividerContent,
  equals,
  fileParser,
  groupParser,
  headingContent,
  ifParser,
  imageContent,
  listParser,
  numberParser,
  paragraphContent,
  rangeParser,
  rawHtmlContent,
  satisfies,
  selectParser,
  SeriForm,
  tableParser,
  textParser,
  unless,
  when,
  type ResolvedParserObject,
} from "../../src/index.ts";

const LOGO_PLACEHOLDER_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' rx='14' fill='%236366f1'/%3E%3C/svg%3E";

const config = createParsers({
  "project-heading": headingContent({ text: "Project details", level: 3 }),
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

  "visibility-divider": dividerContent({}),
  "visibility-heading": headingContent({
    text: "Visibility & scheduling",
    level: 3,
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
  "live-preview": paragraphContent({
    title:
      "A derived text - recomputed live from project-name/visibility/is-public, no `when`/`ifParser` needed since it's always shown",
    text: derived(
      (name, visibility, isPublic) =>
        `"${name}" will launch as ${visibility}${
          isPublic ? ", going live immediately" : ""
        }.`,
      dependency<string>()("project-name"),
      dependency<string>()("visibility"),
      dependency<boolean>()("is-public")
    ),
  }),
  announcement: when({
    condition: equals(["visibility"], "public"),
    label: "Announcement text",
    title: "Shown only while visibility is 'public'",
    parser: paragraphContent({ text: "We're live! Come take a look." }),
  }),
  "status-message": ifParser({
    label: "Status message",
    title: "First matching branch wins",
    branches: [
      {
        condition: equals(["visibility"], "internal"),
        parser: paragraphContent({ text: "Visible to the team only." }),
      },
      {
        condition: equals(["is-public"], true),
        parser: paragraphContent({ text: "Announced to everyone." }),
      },
    ],
    otherwise: paragraphContent({ text: "Draft — not yet shared." }),
  }),

  "branding-divider": dividerContent({}),
  "branding-heading": headingContent({ text: "Branding", level: 3 }),
  "accent-color": colorParser({
    label: "Accent color",
    default: "6366f1",
  }),
  logo: fileParser({
    text: "Upload logo",
    attrs: { accept: "image/*" },
  }),
  "logo-preview": imageContent({
    title: "A static placeholder — swap for real branding",
    attrs: {
      src: LOGO_PLACEHOLDER_SRC,
      alt: "Placeholder logo mark",
      width: 64,
      height: 64,
    },
  }),

  "actions-divider": dividerContent({}),
  "actions-heading": headingContent({
    text: "Capacity & actions",
    level: 3,
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
  notify: buttonContent({
    title:
      "Button text is also a derived value - it stays in sync with capacity",
    text: derived(
      capacity => `Send test notification to up to ${capacity} people`,
      dependency<number>()("capacity")
    ),
    attrs: { class: "primary wrap-text" },
  }),

  "team-divider": dividerContent({}),
  "team-heading": headingContent({ text: "Ownership & team", level: 3 }),
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
        parser: paragraphContent({
          text: "Owner is on call for the first hour after launch.",
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
    parser: paragraphContent({
      text: derived(
        name => `⚠️ ${name ?? "The first team member"} is marked inactive.`,
        dependency<string | undefined>()("team", 0, 0)
      ),
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
    parser: paragraphContent({ text: "Consider trimming down to 2 tags." }),
  }),
  "invite-limit": unless({
    condition: equals(["is-public"], true),
    label: "Invite limit",
    title: "Hidden once the project is public",
    parser: numberParser({ default: 25, attrs: { min: "0", max: "1000" } }),
  }),

  "help-divider": dividerContent({}),
  "help-note": rawHtmlContent({
    html:
      "<p>Want to see more field types in action? Check the " +
      '<a href="https://github.com/eniallator/Seriform#available-value-parsers" target="_blank" rel="noreferrer">full parser reference</a>' +
      " in the README.</p>",
  }),
});

export type Config =
  typeof config extends ResolvedParserObject<infer R> ? R : never;

const configEl = dom.get("#config-ui");
const valuesOutputEl = dom.get("#values-output");
const urlOutputEl = dom.get("#url-output");
const shareStatusEl = dom.get("#share-status");
const toastEl = dom.get("#toast");
const shortUrlToggleEl = dom.get<HTMLInputElement>("#short-url-toggle");
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

const hideToast = debounce(() => {
  toastEl.hidden = true;
}, 2200);
const showToast = (message: string): void => {
  toastEl.textContent = message;
  toastEl.hidden = false;
  hideToast();
};

// `shortUrl` can only be set at construction time, so toggling it re-mounts the whole
// form. The very first mount reads `location.search` as usual; every mount after that
// carries the outgoing form's live values across instead, so toggling mid-edit doesn't
// throw away unsaved changes by falling back to whatever was in the URL on page load.
const mount = (shortUrl: boolean): void => {
  const previousValues = seriform?.getAllValues() ?? null;

  configEl.innerHTML = "";
  const query = previousValues == null ? location.search : "";
  const form = new SeriForm(
    config,
    configEl,
    shortUrl ? { query, shortUrl: true, hashLength: 2 } : { query }
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

const hideShareStatus = debounce(() => {
  shareStatusEl.hidden = true;
}, 1800);
dom.addListener(dom.get("#share-button"), "click", () => {
  void navigator.clipboard.writeText(buildShareUrl());

  shareStatusEl.hidden = false;
  hideShareStatus();
});

dom.addListener(shortUrlToggleEl, "change", () => {
  mount(shortUrlToggleEl.checked);
});

mount(shortUrlToggleEl.checked);
