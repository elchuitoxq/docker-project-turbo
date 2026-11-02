import { notFound } from 'next/navigation';
import { GuideModuleView } from '@/components/guides/guide-module-view';
import { findGuideModule } from '@/lib/guides/registry';

export default async function ModuleGuidePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: moduleId } = await params;
  const guideModule = findGuideModule(moduleId);
  if (!guideModule) notFound();

  return <GuideModuleView module={guideModule} />;
}
