import { useLocale } from '@/contexts/LocaleContext';
import { useTranslation } from '@/lib/i18n';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Users, Calendar, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

const Admin = () => {
  const { locale } = useLocale();
  const { t } = useTranslation(locale);

  const adminSections = [
    {
      icon: Users,
      title: t('admin.users'),
      description: t('admin.usersDescription'),
      href: '/admin/users',
    },
    {
      icon: FileText,
      title: t('admin.news'),
      description: t('admin.newsDescription'),
      href: '/admin/news',
    },
    {
      icon: Calendar,
      title: t('admin.schedule'),
      description: t('admin.scheduleDescription'),
      href: '/admin/schedule',
    },
    {
      icon: Settings,
      title: t('admin.settings'),
      description: t('admin.settingsDescription'),
      href: '/admin/settings',
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('nav.admin')}</h1>
          <p className="text-muted-foreground">{t('admin.description')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {adminSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link key={section.href} to={section.href}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle>{section.title}</CardTitle>
                    </div>
                    <CardDescription>{section.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default Admin;
