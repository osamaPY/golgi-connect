import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useTranslation } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

const Parcels = () => {
  const { user } = useAuth();
  const { locale } = useLocale();
  const { t } = useTranslation(locale);

  const { data: parcels, isLoading } = useQuery({
    queryKey: ['userParcels', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('parcels')
        .select('*')
        .eq('user_id', user.id)
        .order('arrived_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'arrived':
        return <Badge variant="default" className="flex items-center gap-1"><Clock className="h-3 w-3" /> {t('parcels.arrived')}</Badge>;
      case 'notified':
        return <Badge variant="secondary" className="flex items-center gap-1"><Package className="h-3 w-3" /> {t('parcels.notified')}</Badge>;
      case 'picked_up':
        return <Badge variant="outline" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {t('parcels.pickedUp')}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('nav.parcels')}</h1>
            <p className="text-muted-foreground">{t('parcels.description')}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : parcels && parcels.length > 0 ? (
          <div className="grid gap-4">
            {parcels.map(parcel => (
              <Card key={parcel.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{parcel.carrier || t('parcels.unknownCarrier')}</CardTitle>
                      <CardDescription>
                        {t('parcels.arrived')}: {format(new Date(parcel.arrived_at), 'PPp')}
                      </CardDescription>
                    </div>
                    {getStatusBadge(parcel.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {parcel.tracking_number && (
                    <p className="text-sm">
                      <span className="font-medium">{t('parcels.tracking')}:</span> {parcel.tracking_number}
                    </p>
                  )}
                  {parcel.notes && (
                    <p className="text-sm text-muted-foreground">{parcel.notes}</p>
                  )}
                  {parcel.picked_up_at && (
                    <p className="text-sm text-muted-foreground">
                      {t('parcels.pickedUpAt')}: {format(new Date(parcel.picked_up_at), 'PPp')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{t('parcels.noParcels')}</p>
              <p className="text-sm text-muted-foreground">{t('parcels.noParcelsDescription')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Parcels;
