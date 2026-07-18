import React from 'react';
import { Badge } from '../ui/Badge';
export function TextBadge({ children, variant = 'genre', ...props }) {
  return (
    <Badge variant={variant} {...props}>
      {children}
    </Badge>
  );
}