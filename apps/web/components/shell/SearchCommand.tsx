"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Kbd } from "@/components/ui/kbd";

const OPEN_EVENT = "pramana:search";

/** Opens the search from anywhere (the bottom bar, a page's empty state). */
export function openSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

// The dialog (and cmdk) load on first use; hovering or focusing the field, or ⌘K, starts the
// load so it is there by the time the dialog opens. Until then nothing is drawn for it, and
// what is typed is kept and handed to it.
type Dialog = typeof import("./SearchDialog").SearchDialog;
let loading: Promise<Dialog> | null = null;
const loadDialog = () =>
  (loading ??= import("./SearchDialog")
    .then((m) => m.SearchDialog)
    .catch((e: unknown) => {
      loading = null; // offline: the next try fetches again
      throw e;
    }));
const preloadDialog = () => void loadDialog().catch(() => {});

/** ⌘K search across pages, people, places and claims. Diacritics optional. */
export function SearchCommand() {
  const [open, setOpen] = useState(false);
  // Mounted from the first open on, so a half-typed query survives closing it.
  const [wanted, setWanted] = useState(false);
  const [Dialog, setDialog] = useState<ComponentType<Parameters<Dialog>[0]> | null>(null);
  const typed = useRef({ text: "", enter: false });
  const openRef = useRef(open);
  openRef.current = open;
  const show = (next: boolean) => {
    if (next) setWanted(true);
    setOpen(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        preloadDialog();
        setWanted(true);
        setOpen((o) => !o);
      }
    };
    const onOpen = () => show(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Opened before the dialog arrived: keep the keys typed meanwhile.
  useEffect(() => {
    if (!wanted || Dialog) return;
    let live = true;
    loadDialog()
      .then((d) => live && setDialog(() => d))
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (!openRef.current || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const t = typed.current;
      if (e.key.length === 1) t.text += e.key;
      else if (e.key === "Backspace") t.text = t.text.slice(0, -1);
      else if (e.key === "Enter") t.enter = true;
      else if (e.key === "Escape") setOpen(false);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      live = false;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [wanted, Dialog, open]);

  const preload = { onPointerEnter: preloadDialog, onFocus: preloadDialog };
  return (
    <>
      {/* Phones: an icon button. Larger: a search field that opens the palette. */}
      <button
        type="button"
        onClick={() => show(true)}
        onTouchStart={preloadDialog}
        {...preload}
        aria-label="Search"
        className="inline-flex size-9 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-rule-soft hover:text-ink sm:hidden"
      >
        <Search className="size-[18px]" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => show(true)}
        {...preload}
        className="hidden h-8 items-center gap-2 rounded-md border border-rule bg-paper px-2.5 font-sans text-ui text-ink-3 transition-colors hover:border-ink-3/60 hover:text-ink-2 sm:flex sm:w-56 lg:w-72"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Search</span>
        <Kbd className="ml-auto hidden md:inline-flex">⌘K</Kbd>
      </button>
      {wanted && Dialog && <Dialog open={open} onOpenChange={setOpen} typed={typed.current} />}
    </>
  );
}
