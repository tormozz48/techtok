const GITHUB_PAGES_HOST = 'tormozz48.github.io';
const GITHUB_PAGES_A = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'];
const GITHUB_PAGES_AAAA = [
  '2606:50c0:8000::153',
  '2606:50c0:8001::153',
  '2606:50c0:8002::153',
  '2606:50c0:8003::153',
];

export const PROJECT_DOMAIN = 'techtokapp.eu';
export const RECORD_TTL = 300;

export const zone = await aws.route53.getZone({ name: PROJECT_DOMAIN, privateZone: false });

new aws.route53.Record('SiteApexIpv4Record', {
  zoneId: zone.zoneId,
  name: PROJECT_DOMAIN,
  type: 'A',
  ttl: RECORD_TTL,
  records: GITHUB_PAGES_A,
  allowOverwrite: true,
});

new aws.route53.Record('SiteApexIpv6Record', {
  zoneId: zone.zoneId,
  name: PROJECT_DOMAIN,
  type: 'AAAA',
  ttl: RECORD_TTL,
  records: GITHUB_PAGES_AAAA,
  allowOverwrite: true,
});

new aws.route53.Record('SiteWwwRecord', {
  zoneId: zone.zoneId,
  name: `www.${PROJECT_DOMAIN}`,
  type: 'CNAME',
  ttl: RECORD_TTL,
  records: [GITHUB_PAGES_HOST],
  allowOverwrite: true,
});
