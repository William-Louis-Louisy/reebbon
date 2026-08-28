import { StyleSheet, View } from 'react-native';

import { designSystemTokens } from '@/shared/theme';

import { AppText } from '../../components/app-text';
import { ScreenShell } from '../../components/screen-shell';
import { SectionCard } from '../../components/section-card';

const preservedFoundations = [
  'Expo, Expo Router, expo-dev-client et TypeScript strict restent en place.',
  'Aucune reinitialisation de projet ni remplacement de configuration Expo.',
  'Les points d entree `src/app/` deviennent des wrappers pour la couche presentation.',
] as const;

const deliveredFoundations = [
  'Tokens types pour couleurs, typographies, espacements, rayons et durees.',
  'Chargement offline des polices Fraunces, Public Sans, Literata et IBM Plex Mono.',
  'Scripts `lint`, `typecheck`, `test` et `check` explicitement declares.',
] as const;

const deliberateNonScope = [
  'Aucun ecran bibliotheque, import metier ou renderer EPUB/PDF/images.',
  'Aucun acces SQLite, FileSystem ou logique de domaine du Sprint 1+.',
  'Aucune decision implicite sur la personnalisation ou le ruban metier.',
] as const;

export default function HomeScreen() {
  return (
    <ScreenShell
      eyebrow="Issue #1 - INFRA-01"
      title="Fondations consolidees"
      description="Le projet quitte le template Expo generique pour un socle Reebbon coherent, sans demarrer les fonctionnalites metier des sprints suivants.">
      <SectionCard eyebrow="Conserve" title="Ce qui existait deja">
        <BulletList items={preservedFoundations} />
      </SectionCard>

      <SectionCard eyebrow="Ajoute" title="Ce que cette issue apporte">
        <BulletList items={deliveredFoundations} />
      </SectionCard>

      <SectionCard eyebrow="Garde-fous" title="Ce qui reste volontairement hors scope">
        <BulletList items={deliberateNonScope} />
      </SectionCard>
    </ScreenShell>
  );
}

function BulletList({ items }: { readonly items: readonly string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item} style={styles.row}>
          <AppText variant="eyebrow" tone="accent">
            -
          </AppText>
          <AppText>{item}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: designSystemTokens.spacing[3],
  },
  row: {
    flexDirection: 'row',
    gap: designSystemTokens.spacing[3],
    alignItems: 'flex-start',
  },
});
