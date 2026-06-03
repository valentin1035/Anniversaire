"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav-items";

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <>
      <aside className="sidebarNav" aria-label="Navigation principale">
        <p className="sidebarBrand">GAME ON</p>
        <nav>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? "navLink active" : "navLink"}>
                <Icon size={18} strokeWidth={2.2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <nav className="bottomNav" aria-label="Navigation mobile">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} className={active ? "bottomNavItem active" : "bottomNavItem"}>
              <Icon size={20} strokeWidth={2.2} />
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
