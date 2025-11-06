import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useTranslation } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pin, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { it, enUS } from 'date-fns/locale';

interface NewsPost {
  id: string;
  title: string;
  title_en: string | null;
  content: string;
  content_en: string | null;
  is_pinned: boolean;
  published_at: string;
  expires_at: string | null;
}

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const { t } = useTranslation(locale);
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchNews();
    }
  }, [user]);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .not('published_at', 'is', null)
        .lte('published_at', new Date().toISOString())
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false });

      if (error) throw error;
      setNews(data || []);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return null;
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Welcome Section */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">
            {locale === 'it' ? 'Benvenuto' : 'Welcome'}
          </h1>
          <p className="text-xl text-muted-foreground">
            {user.email?.split('@')[0]}
          </p>
        </div>

        {/* News Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{t('news.title')}</h2>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : news.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {t('news.noNews')}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {news.map((post) => (
                <Card
                  key={post.id}
                  className={`transition-all hover:shadow-md ${
                    post.is_pinned ? 'border-primary/50 bg-primary/5' : ''
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="flex items-center gap-2">
                          {post.is_pinned && (
                            <Pin className="h-4 w-4 text-primary" />
                          )}
                          {locale === 'en' && post.title_en
                            ? post.title_en
                            : post.title}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {format(
                            new Date(post.published_at),
                            'PPP',
                            { locale: locale === 'it' ? it : enUS }
                          )}
                        </CardDescription>
                      </div>
                      {post.is_pinned && (
                        <Badge variant="secondary">{t('news.pinned')}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {locale === 'en' && post.content_en
                        ? post.content_en
                        : post.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Index;
