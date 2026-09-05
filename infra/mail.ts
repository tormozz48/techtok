const REGION = 'eu-central-1';
const MAIL_DOMAIN = 'techtokapp.eu';
const MAIL_RECIPIENTS = ['privacy', 'support', 'noreply'];
const MAIL_OBJECT_PREFIX = 'inbound/';
const MAIL_VIA_LABEL = 'via TechTok';
const INBOUND_RETENTION_DAYS = 30;
const RULE_SET_NAME = 'techtok-inbound';
const RULE_NAME = 'forward-to-gmail';
const SPF_VALUE = 'v=spf1 include:amazonses.com ~all';
const DMARC_VALUE = 'v=DMARC1; p=none';
const DKIM_TOKEN_COUNT = 3;

const APEX_TXT_EXTRA_VALUES: string[] = [];

export const mailForwardTo = new sst.Secret('MailForwardTo');

const callerIdentity = await aws.getCallerIdentity({});
const zone = await aws.route53.getZone({ name: MAIL_DOMAIN, privateZone: false });

const bucketName = `techtok-mail-inbound-${callerIdentity.accountId}`;
const inboundObjectArn = `arn:aws:s3:::${bucketName}/${MAIL_OBJECT_PREFIX}*`;
const receiptRuleArn = `arn:aws:ses:${REGION}:${callerIdentity.accountId}:receipt-rule-set/${RULE_SET_NAME}:receipt-rule/${RULE_NAME}`;

const inboundMailBucket = new aws.s3.BucketV2(
  'InboundMailBucket',
  { bucket: bucketName },
  { import: bucketName, retainOnDelete: true },
);

new aws.s3.BucketPublicAccessBlock('InboundMailPublicAccessBlock', {
  bucket: inboundMailBucket.id,
  blockPublicAcls: true,
  ignorePublicAcls: true,
  blockPublicPolicy: true,
  restrictPublicBuckets: true,
});

new aws.s3.BucketLifecycleConfigurationV2('InboundMailLifecycle', {
  bucket: inboundMailBucket.id,
  rules: [
    {
      id: 'expire-inbound',
      status: 'Enabled',
      filter: { prefix: MAIL_OBJECT_PREFIX },
      expiration: { days: INBOUND_RETENTION_DAYS },
    },
  ],
});

const inboundMailBucketPolicy = new aws.s3.BucketPolicy('InboundMailBucketPolicy', {
  bucket: inboundMailBucket.id,
  policy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowSESPuts',
        Effect: 'Allow',
        Principal: { Service: 'ses.amazonaws.com' },
        Action: 's3:PutObject',
        Resource: inboundObjectArn,
        Condition: {
          StringEquals: { 'aws:SourceAccount': callerIdentity.accountId },
          StringLike: {
            'aws:SourceArn': `arn:aws:ses:${REGION}:${callerIdentity.accountId}:receipt-rule-set/*`,
          },
        },
      },
    ],
  }),
});

const mailDomainIdentity = new aws.ses.DomainIdentity(
  'MailDomainIdentity',
  { domain: MAIL_DOMAIN },
  { import: MAIL_DOMAIN, retainOnDelete: true },
);

const mailDomainDkim = new aws.ses.DomainDkim(
  'MailDomainDkim',
  { domain: MAIL_DOMAIN },
  { import: MAIL_DOMAIN },
);

const apexTxtRecord = new aws.route53.Record('MailApexTxtRecord', {
  zoneId: zone.zoneId,
  name: MAIL_DOMAIN,
  type: 'TXT',
  ttl: 300,
  records: [SPF_VALUE, ...APEX_TXT_EXTRA_VALUES],
  allowOverwrite: true,
});

new aws.route53.Record('MailDmarcRecord', {
  zoneId: zone.zoneId,
  name: `_dmarc.${MAIL_DOMAIN}`,
  type: 'TXT',
  ttl: 300,
  records: [DMARC_VALUE],
  allowOverwrite: true,
});

const dkimRecords = Array.from({ length: DKIM_TOKEN_COUNT }, (_unused, index) => {
  const token = mailDomainDkim.dkimTokens.apply((tokens) => tokens[index]);
  return new aws.route53.Record(`MailDkimRecord${index}`, {
    zoneId: zone.zoneId,
    name: $interpolate`${token}._domainkey.${MAIL_DOMAIN}`,
    type: 'CNAME',
    ttl: 300,
    records: [$interpolate`${token}.dkim.amazonses.com`],
    allowOverwrite: true,
  });
});

export const mailForwarder = new sst.aws.Function('MailForwarder', {
  handler: 'packages/functions/src/mail/forwarder.handler',
  runtime: 'nodejs22.x',
  timeout: '30 seconds',
  memory: '256 MB',
  link: [mailForwardTo],
  environment: {
    MAIL_BUCKET: bucketName,
    MAIL_OBJECT_PREFIX,
    MAIL_FORWARD_TO: mailForwardTo.value,
    MAIL_DOMAIN,
    MAIL_FALLBACK_FROM: `postmaster@${MAIL_DOMAIN}`,
    MAIL_VIA_LABEL,
  },
  permissions: [{ actions: ['s3:GetObject'], resources: [inboundObjectArn] }],
});

new aws.iam.RolePolicy('MailForwarderSendPolicy', {
  role: mailForwarder.nodes.role.name,
  policy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: 'ses:SendRawEmail',
        Resource: '*',
        Condition: { StringLike: { 'ses:FromAddress': `*@${MAIL_DOMAIN}` } },
      },
    ],
  }),
});

const sesInvokePermission = new aws.lambda.Permission('MailForwarderSesInvoke', {
  action: 'lambda:InvokeFunction',
  function: mailForwarder.arn,
  principal: 'ses.amazonaws.com',
  sourceAccount: callerIdentity.accountId,
  sourceArn: receiptRuleArn,
});

const inboundRuleSet = new aws.ses.ReceiptRuleSet(
  'InboundRuleSet',
  { ruleSetName: RULE_SET_NAME },
  { import: RULE_SET_NAME, retainOnDelete: true },
);

new aws.ses.ReceiptRule(
  'ForwardToGmailRule',
  {
    name: RULE_NAME,
    ruleSetName: inboundRuleSet.ruleSetName,
    enabled: true,
    scanEnabled: true,
    tlsPolicy: 'Optional',
    recipients: MAIL_RECIPIENTS.map((localPart) => `${localPart}@${MAIL_DOMAIN}`),
    s3Actions: [{ position: 1, bucketName, objectKeyPrefix: MAIL_OBJECT_PREFIX }],
    lambdaActions: [{ position: 2, functionArn: mailForwarder.arn, invocationType: 'Event' }],
  },
  {
    import: `${RULE_SET_NAME}:${RULE_NAME}`,
    dependsOn: [inboundMailBucketPolicy, sesInvokePermission],
  },
);

const activeInboundRuleSet = new aws.ses.ActiveReceiptRuleSet(
  'ActiveInboundRuleSet',
  { ruleSetName: inboundRuleSet.ruleSetName },
  { import: RULE_SET_NAME },
);

const mailDomainVerification = new aws.ses.DomainIdentityVerification(
  'MailDomainVerification',
  { domain: mailDomainIdentity.domain },
  { dependsOn: [apexTxtRecord, ...dkimRecords] },
);

new aws.route53.Record(
  'MailMxRecord',
  {
    zoneId: zone.zoneId,
    name: MAIL_DOMAIN,
    type: 'MX',
    ttl: 300,
    records: [`10 inbound-smtp.${REGION}.amazonaws.com`],
    allowOverwrite: true,
  },
  { dependsOn: [mailDomainVerification, activeInboundRuleSet] },
);
