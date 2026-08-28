import { StyleSheet, Text, View } from 'react-native';

import { designSystemTokens, readingThemes } from '@/shared/theme';
import { offlineFontFamilies } from '@/shared/theme/fonts';

import { AppText } from '../../components/app-text';
import { ScreenShell } from '../../components/screen-shell';
import { SectionCard } from '../../components/section-card';

const chromeThemePreviews = [
  {
    title: 'Paper',
    description: 'UI claire de l application',
    background: designSystemTokens.colors.paper,
    text: designSystemTokens.colors.paperText,
    border: designSystemTokens.colors.borderLight,
  },
  {
    title: 'Walnut',
    description: 'Chrome sombre de l application',
    background: designSystemTokens.colors.walnut,
    text: designSystemTokens.colors.walnutText,
    border: designSystemTokens.colors.borderDark,
  },
] as const;

const typeScale = [
  ['Fraunces', 'display / marque'],
  ['Public Sans', 'interface'],
  ['Literata', 'lecture EPUB'],
  ['IBM Plex Mono', 'folios / métadonnées'],
] as const;

export default function DesignSystemScreen() {
  return (
    <ScreenShell
      eyebrow="Design System"
      title="Tokens derives du guide"
      description="Les valeurs exposees dans l application sont reprises de `docs/design-system.html` et restent disponibles pour les couches suivantes sans dependance runtime a Google Fonts.">
      <SectionCard eyebrow="UI" title="Themes d application">
        <View style={styles.previewGrid}>
          {chromeThemePreviews.map((preview) => (
            <PreviewCard
              key={preview.title}
              title={preview.title}
              description={preview.description}
              background={preview.background}
              text={preview.text}
              border={preview.border}
            />
          ))}
        </View>
      </SectionCard>

      <SectionCard eyebrow="Lecture" title="Surfaces prevues pour les themes lecteur">
        <View style={styles.previewGrid}>
          {Object.values(readingThemes).map((preview) => (
            <PreviewCard
              key={preview.name}
              title={preview.name}
              description="Préparé pour les futurs renderers"
              background={preview.background}
              text={preview.text}
              border={preview.border}
            />
          ))}
        </View>
      </SectionCard>

      <SectionCard eyebrow="Typo" title="Familles embarquees">
        <View style={styles.metaList}>
          {typeScale.map(([family, usage]) => (
            <View key={family} style={styles.metaRow}>
              <AppText variant="screenTitle">{family}</AppText>
              <AppText tone="muted">{usage}</AppText>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard eyebrow="Motion" title="Durees exposees">
        <View style={styles.motionRow}>
          <MotionChip label="Quick" value={designSystemTokens.motion.quickFeedback} />
          <MotionChip label="UI" value={designSystemTokens.motion.uiTransition} />
          <MotionChip
            label="Reading"
            value={designSystemTokens.motion.readingThemeTransition}
          />
        </View>
      </SectionCard>
    </ScreenShell>
  );
}

type PreviewCardProps = {
  readonly title: string;
  readonly description: string;
  readonly background: string;
  readonly text: string;
  readonly border: string;
};

function PreviewCard({ title, description, background, text, border }: PreviewCardProps) {
  return (
    <View style={[styles.previewCard, { backgroundColor: background, borderColor: border }]}>
      <Text style={[styles.previewEyebrow, { color: text }]}>{title.toUpperCase()}</Text>
      <Text style={[styles.previewBody, { color: text }]}>
        La bibliotheque reste silencieuse pour laisser toute la place au contenu.
      </Text>
      <Text style={[styles.previewCaption, { color: text }]}>{description}</Text>
    </View>
  );
}

function MotionChip({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <View style={styles.motionChip}>
      <AppText variant="eyebrow" tone="accent">
        {label}
      </AppText>
      <AppText variant="screenTitle">{value} ms</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  previewGrid: {
    gap: designSystemTokens.spacing[4],
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: designSystemTokens.radii.md,
    padding: designSystemTokens.spacing[4],
    gap: designSystemTokens.spacing[3],
  },
  previewEyebrow: {
    fontFamily: offlineFontFamilies.monoMedium,
    fontSize: designSystemTokens.typography.roles.eyebrow.size,
    lineHeight: designSystemTokens.typography.roles.eyebrow.lineHeight,
    letterSpacing: designSystemTokens.typography.roles.eyebrow.tracking,
  },
  previewBody: {
    fontFamily: offlineFontFamilies.readingRegular,
    fontSize: designSystemTokens.typography.roles.reading.size,
    lineHeight: designSystemTokens.typography.roles.reading.lineHeight,
  },
  previewCaption: {
    fontFamily: offlineFontFamilies.uiRegular,
    fontSize: designSystemTokens.typography.roles.caption.size,
    lineHeight: designSystemTokens.typography.roles.caption.lineHeight,
  },
  metaList: {
    gap: designSystemTokens.spacing[3],
  },
  metaRow: {
    gap: designSystemTokens.spacing[1],
  },
  motionRow: {
    gap: designSystemTokens.spacing[3],
  },
  motionChip: {
    borderRadius: designSystemTokens.radii.md,
    paddingHorizontal: designSystemTokens.spacing[4],
    paddingVertical: designSystemTokens.spacing[3],
    backgroundColor: designSystemTokens.colors.paper,
    gap: designSystemTokens.spacing[1],
  },
});
