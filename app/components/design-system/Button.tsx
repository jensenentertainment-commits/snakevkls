import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

import { cn } from "./cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "brand";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonCommonProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

type ButtonElementProps = ButtonCommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonCommonProps> & {
    href?: never;
  };

type ButtonLinkProps = ButtonCommonProps &
  Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    keyof ButtonCommonProps | "href"
  > & {
    href: string;
  };

export type ButtonProps = ButtonElementProps | ButtonLinkProps;

const baseClassName =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-snake-action border font-[var(--snake-font-weight-semibold)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus focus-visible:ring-offset-2 focus-visible:ring-offset-snake-surface motion-reduce:transition-none";

const variantClassNames = {
  primary:
    "border-snake-primary bg-snake-primary text-[var(--snake-color-action-primary-text)] hover:border-snake-primary-hover hover:bg-snake-primary-hover active:border-snake-primary-pressed active:bg-snake-primary-pressed",
  secondary:
    "border-snake-border-default bg-snake-surface text-snake-text-primary hover:border-snake-border-strong hover:bg-snake-surface-subtle active:bg-snake-neutral-surface",
  ghost:
    "border-transparent bg-transparent text-snake-link hover:bg-snake-info-surface active:bg-snake-neutral-surface",
  danger:
    "border-snake-danger-border bg-snake-danger-surface text-snake-danger hover:border-snake-danger hover:bg-snake-danger-surface active:bg-snake-danger-surface",
  brand:
    "border-snake-brand bg-snake-brand text-snake-app-deep hover:border-snake-brand-strong hover:bg-snake-brand-strong active:border-snake-brand-strong active:bg-snake-brand-strong",
} as const satisfies Record<ButtonVariant, string>;

const sizeClassNames = {
  sm: "h-9 px-3 text-[length:var(--snake-text-label-size)] leading-[var(--snake-text-label-line-height)]",
  md: "h-11 px-4 text-[length:var(--snake-text-body-small-size)] leading-[var(--snake-text-body-small-line-height)]",
  lg: "h-14 px-5 text-[length:var(--snake-text-body-size)] leading-[var(--snake-text-body-line-height)]",
} as const satisfies Record<ButtonSize, string>;

const commonPropNames = [
  "children",
  "className",
  "disabled",
  "loading",
  "loadingLabel",
  "size",
  "variant",
] as const satisfies ReadonlyArray<keyof ButtonCommonProps>;

export function Button(props: ButtonProps) {
  const {
    children,
    className,
    disabled = false,
    loading = false,
    loadingLabel = "Laster",
    size = "md",
    variant = "primary",
  } = props;
  const unavailable = disabled || loading;
  const classes = cn(
    baseClassName,
    variantClassNames[variant],
    sizeClassNames[size],
    unavailable && "cursor-not-allowed opacity-50",
    className,
  );
  const content = (
    <>
      {loading ? <LoadingIndicator /> : null}
      <span>{loading ? loadingLabel : children}</span>
    </>
  );

  if ("href" in props && typeof props.href === "string") {
    const { href, ...linkProps } = withoutCommonProps(props);

    if (unavailable) {
      return (
        <span aria-disabled="true" aria-live="polite" className={classes}>
          {content}
        </span>
      );
    }

    return (
      <Link {...linkProps} className={classes} href={href}>
        {content}
      </Link>
    );
  }

  const { type = "button", ...buttonProps } = withoutCommonProps(props);

  return (
    <button
      {...buttonProps}
      aria-busy={loading || undefined}
      className={classes}
      disabled={unavailable}
      type={type}
    >
      {content}
    </button>
  );
}

function withoutCommonProps<T extends ButtonCommonProps>(
  props: T,
): Omit<T, keyof ButtonCommonProps> {
  const nativeProps = { ...props } as Record<string, unknown>;

  for (const propName of commonPropNames) {
    delete nativeProps[propName];
  }

  return nativeProps as Omit<T, keyof ButtonCommonProps>;
}

function LoadingIndicator() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-snake-pill border-2 border-current border-t-transparent opacity-60 motion-reduce:animate-none"
    />
  );
}
