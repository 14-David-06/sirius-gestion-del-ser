# Configuración del Bucket S3 para Firmas Digitales

## 1. Crear Bucket en AWS Console

1. Ir a [S3 Console](https://s3.console.aws.amazon.com/s3/)
2. Click "Create bucket"
3. Configurar:
   - **Bucket name**: `sirius-firmas-trabajadores`
   - **AWS Region**: `us-east-1` (o tu región preferida)
   - **Block all public access**: ✅ HABILITADO (muy importante)
   - **Bucket Versioning**: ✅ HABILITADO
   - **Default encryption**: Server-side encryption with Amazon S3 managed keys (SSE-S3)

## 2. Configurar Lifecycle Policy (Opcional pero recomendado)

Archiva firmas antiguas a Glacier para reducir costos:

```json
{
  "Rules": [
    {
      "Id": "Archive-old-firmas",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "firmas/"
      },
      "Transitions": [
        {
          "Days": 365,
          "StorageClass": "GLACIER"
        }
      ]
    }
  ]
}
```

**Aplicar:**
1. Bucket → Management → Lifecycle rules → Create lifecycle rule
2. Paste el JSON anterior
3. Save

## 3. Crear Usuario IAM con Permisos Mínimos

**Paso 1:** Crear política personalizada

Ir a IAM → Policies → Create policy → JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPutAndGet",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:GetObjectVersion"
      ],
      "Resource": "arn:aws:s3:::sirius-firmas-trabajadores/*"
    },
    {
      "Sid": "AllowListBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::sirius-firmas-trabajadores"
    }
  ]
}
```

**IMPORTANTE:** NO incluir `s3:DeleteObject` — seguridad por diseño.

Guardar como: `SiriusFirmasPolicy`

**Paso 2:** Crear usuario IAM

1. IAM → Users → Add user
2. **User name**: `sirius-firmas-uploader`
3. **Access type**: Programmatic access
4. **Attach policies**: `SiriusFirmasPolicy`
5. **Download** las credenciales (Access Key ID + Secret Access Key)

## 4. Configurar Variables de Entorno

Agregar a `.env.local`:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_FIRMAS=sirius-firmas-trabajadores
```

**NUNCA** commitear este archivo — ya está en `.gitignore`.

## 5. Verificar Configuración

```bash
# Desde el proyecto, ejecutar:
node -e "
const { getS3Client } = require('./src/lib/s3/client.ts');
const client = getS3Client();
console.log('✅ Cliente S3 inicializado correctamente');
"
```

## 6. Estructura de Carpetas en S3

Después del primer upload, el bucket tendrá:

```
sirius-firmas-trabajadores/
├── firmas/
│   ├── permisos/
│   │   ├── SIRIUS-PER-0001/
│   │   │   ├── 1720353600000_1234567890.png
│   │   │   └── 1720440000000_1234567890.png
│   │   └── SIRIUS-PER-0002/
│   │       └── 1720526400000_9876543210.png
│   ├── vacaciones/
│   │   └── SIRIUS-PER-0001/
│   │       └── 1720612800000_1234567890.png
│   └── contratos/
│       └── ...
```

## 7. Costos Estimados (Colombia - us-east-1)

| Item | Cantidad | Costo mensual |
|------|----------|---------------|
| Almacenamiento S3 Standard | 1 GB (≈10,000 firmas) | $0.023 |
| Requests PUT (uploads) | 500 permisos/mes | $0.0025 |
| Requests GET (vistas) | 2,000 visualizaciones/mes | $0.0008 |
| Data transfer OUT | 100 MB | $0.009 |
| **TOTAL** | | **~$0.04/mes** |

Después de 1 año con Glacier:
- Almacenamiento Glacier: 10 GB → $0.004/mes
- **Ahorro:** 99% vs mantener en Standard

## 8. Monitoreo y Alertas (Opcional)

### CloudWatch Alarm - Uploads anómalos

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name sirius-firmas-high-uploads \
  --alarm-description "Alerta si hay >1000 uploads/hora" \
  --metric-name NumberOfObjects \
  --namespace AWS/S3 \
  --statistic Sum \
  --period 3600 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=BucketName,Value=sirius-firmas-trabajadores
```

### CloudTrail - Auditoría de accesos

1. CloudTrail → Create trail
2. Trail name: `sirius-s3-audit`
3. S3 bucket: crear nuevo bucket para logs
4. **Data events**: incluir `s3://sirius-firmas-trabajadores/`

Esto registra QUIÉN accedió CUÁNDO a cada firma (compliance).

## 9. Troubleshooting

### Error: "Access Denied"
- Verificar que el usuario IAM tenga la política `SiriusFirmasPolicy`
- Verificar que las credenciales en `.env.local` sean correctas
- Verificar que el bucket NO tenga "Block all public access" en los permisos del usuario

### Error: "Bucket does not exist"
- Verificar `AWS_REGION` en `.env.local` coincide con región del bucket
- Verificar `S3_BUCKET_FIRMAS` tenga el nombre exacto

### Firmas no aparecen en Airtable
- Verificar que el campo `Firma_S3_Key` exista en Solicitud_Permiso
- Verificar logs del servidor: `console.log` muestra errores de S3

## 10. Migración de Firmas Existentes (Si aplica)

Si ya tienes firmas en base64 en Airtable, ejecutar script de migración:

```bash
npm run migrate:firmas-to-s3
```

(Script pendiente de crear — contactar a desarrollo)

---

**Documentado:** 2026-07-07  
**Última revisión:** 2026-07-07  
**Responsable:** Equipo Desarrollo Sirius
