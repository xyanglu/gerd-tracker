export const colors = {
  primary: '#2E7D32',       // deep green
  primaryLight: '#4CAF50',
  primaryBg: '#E8F5E9',
  accent: '#FF8F00',        // amber
  accentLight: '#FFE082',
  danger: '#C62828',
  dangerLight: '#FFCDD2',
  warning: '#F57F17',
  warningLight: '#FFF9C4',
  info: '#1565C0',
  infoLight: '#BBDEFB',
  surface: '#FFFFFF',
  background: '#F5F5F5',
  border: '#E0E0E0',
  textPrimary: '#212121',
  textSecondary: '#616161',
  textDisabled: '#9E9E9E',
  severity1: '#66BB6A',
  severity2: '#FFCA28',
  severity3: '#FFA726',
  severity4: '#EF5350',
  severity5: '#B71C1C',
};

export function severityColor(severity: number): string {
  switch (severity) {
    case 1: return colors.severity1;
    case 2: return colors.severity2;
    case 3: return colors.severity3;
    case 4: return colors.severity4;
    case 5: return colors.severity5;
    default: return colors.textSecondary;
  }
}

export function severityLabel(severity: number): string {
  switch (severity) {
    case 1: return 'Mild';
    case 2: return 'Noticeable';
    case 3: return 'Moderate';
    case 4: return 'Severe';
    case 5: return 'Intense';
    default: return 'Unknown';
  }
}
