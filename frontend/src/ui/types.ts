/** Shared enums for ui/ primitives. Kept apart from components for fast refresh. */

export enum ButtonVariant {
  Primary = 'primary',
  Secondary = 'secondary',
  Ghost = 'ghost',
  Danger = 'danger',
}

export enum ControlSize {
  Md = 'md',
  Sm = 'sm',
}

/** Semantic tone. Colour is always paired with text or an icon. */
export enum Tone {
  Neutral = 'neutral',
  Pos = 'pos',
  Warn = 'warn',
  Crit = 'crit',
  Accent = 'accent',
}

export enum MoneySize {
  Inline = 'inline',
  Medium = 'medium',
  Large = 'large',
  Hero = 'hero',
}

export enum MenuAlign {
  Start = 'start',
  End = 'end',
}

export enum DrawerSide {
  Right = 'right',
  Bottom = 'bottom',
}

export enum ToastKind {
  Info = 'info',
  Success = 'success',
  Error = 'error',
}

export enum CellAlign {
  Start = 'start',
  End = 'end',
  Center = 'center',
}

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  hint?: string;
  disabled?: boolean;
}
