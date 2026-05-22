"use client";

import NextLink from "next/link";
import { usePathname, useParams as useNextParams, useRouter, useSearchParams } from "next/navigation";
import { type ComponentProps, type ReactNode, useEffect } from "react";

type LinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & {
  readonly to: string;
  readonly children: ReactNode;
};

export function Link({ to, children, ...props }: LinkProps) {
  return (
    <NextLink href={to} {...props}>
      {children}
    </NextLink>
  );
}

export function useNavigate() {
  const router = useRouter();

  return (to: string) => {
    router.push(to);
  };
}

export function useParams() {
  return useNextParams();
}

export function useLocation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";

  return {
    pathname,
    search: search.length > 0 ? `?${search}` : ""
  };
}

export function Navigate({ to }: { readonly to: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(to);
  }, [router, to]);

  return null;
}
