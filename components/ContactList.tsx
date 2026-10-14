import { ExternalLink, Phone } from "lucide-react";
import { CONTACTS } from "@/lib/data/contacts";
import type { Dict } from "@/lib/i18n";

// Numren kommer alltid från lib/data/contacts.ts, aldrig från AI. Bara beskrivningen översätts.
export function ContactList({ dict }: { dict: Dict }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {CONTACTS.map((c) => {
        const label = dict.contacts[c.id] ?? c.name;
        const isPhone = "number" in c;
        const href = isPhone ? `tel:${c.number.replace(/[^\d+]/g, "")}` : c.url;
        return (
          <li key={c.id}>
            <a
              href={href}
              {...(isPhone ? {} : { target: "_blank", rel: "noopener noreferrer" })}
              className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                {isPhone ? <Phone aria-hidden className="size-5" /> : <ExternalLink aria-hidden className="size-5" />}
              </span>
              <span className="min-w-0">
                {isPhone && (
                  <span dir="ltr" className="block text-xl font-bold text-primary">
                    {c.number}
                  </span>
                )}
                <span className="block text-base leading-snug">{label}</span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
