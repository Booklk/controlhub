#!/bin/bash
# Control Hub - Server Update Script
# شغّل هالسكربت على سيرفرك: bash update-server.sh

set -e
cd /var/www/control-hub

echo "=== 1. تحديث اسم الإشعارات ==="

# server/email.ts
sed -i "s|مركز التحكم - نادي سباقات الخيل|Control Hub - JCSA|g" server/email.ts
sed -i "s|مركز التحكم - Control Hub|Control Hub - JCSA|g" server/email.ts
sed -i "s|نظام مركز التحكم الخاص بنادي سباقات الخيل|نظام Control Hub الخاص بنادي سباقات الخيل|g" server/email.ts
sed -i "s|لحسابكم في نظام مركز التحكم|لحسابكم في نظام Control Hub|g" server/email.ts

# server/email-templates.ts
sed -i "s|مركز التحكم - Control Hub|Control Hub - JCSA|g" server/email-templates.ts
sed -i "s|<p class=\"header-subtitle\">مركز التحكم</p>|<p class=\"header-subtitle\">Control Hub</p>|g" server/email-templates.ts
sed -i "s|مرحباً بكم في مركز التحكم|مرحباً بكم في Control Hub|g" server/email-templates.ts
sed -i "s|في نظام مركز التحكم\. فيما يلي|في نظام Control Hub. فيما يلي|g" server/email-templates.ts

# server/routes.ts
sed -i "s|تفعيل حسابك في مركز التحكم - JCSA|تفعيل حسابك في Control Hub - JCSA|g" server/routes.ts

# shared/constants.ts
sed -i "s|APP_NAME_AR: 'مركز التحكم'|APP_NAME_AR: 'Control Hub'|g" shared/constants.ts

# client/src/App.tsx
sed -i "s|مركز التحكم - نادي سباقات الخيل|Control Hub - JCSA|g" client/src/App.tsx

# client/src/pages/EmployeePortal.tsx
sed -i "s|مرحباً بك في مركز التحكم|مرحباً بك في Control Hub|g" client/src/pages/EmployeePortal.tsx
sed -i "s|مركز التحكم - نادي سباقات الخيل السعودي|Control Hub - JCSA|g" client/src/pages/EmployeePortal.tsx

# client/src/pages/not-found.tsx
sed -i "s|مركز التحكم - نادي سباقات الخيل|Control Hub - JCSA|g" client/src/pages/not-found.tsx

# client/src/pages/AdminDashboard.tsx
sed -i "s|نادي سباقات الخيل - مركز التحكم|Control Hub - JCSA|g" client/src/pages/AdminDashboard.tsx

echo "=== 2. إعادة البناء ==="
npm run build

echo "=== 3. إعادة تشغيل PM2 ==="
pm2 restart all

echo "=== تم بنجاح! ==="
