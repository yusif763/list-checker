# Siyahı Yoxlama Sistemi

AI əsaslı **Excel və şəxsiyyət sənədi yoxlama platforması**. Next.js (App Router) +
TypeScript ilə qurulub, tam **Netlify-a uyğun** (serverless) — verilənlər bazası, Redis və
ya davamlı fayl saxlama tələb etmir.

İnterfeys tam **Azərbaycan dilindədir**.

> **Əsas qayda:** Yekun Siyahı (Final List) əsas mənbədir. Bütün yoxlama, müqayisə və
> hesabatlar Yekun Siyahının şəxsləri ətrafında qurulur. Müqayisə istiqaməti həmişə
> **Yekun → Əsas** və **Yekun ↔ Şəxsiyyət vəsiqəsi**-dir.

## Nə işləyir

- **Dinamik Excel importu** — `.xlsx/.xls/.csv`, başlıq sətrinin avtomatik aşkarlanması
  (məs. 3-cü sətirdə), çoxlu vərəq, fərqli sütun adları (AZ/EN), sütun uyğunlaşdırma
  önizləməsi və əl ilə düzəliş.
- **Birləşmiş tam ad ayrılması** — `Məmmədov Əli Hüseyn oğlu` → soyad/ad/ata adı
  (qeyri-müəyyən hallar yoxlamaya göndərilir).
- **Deterministik yoxlama mühərriki** — FİN, telefon `(0XX) XXX XX XX`, tarix `GG.AA.İİİİ`
  (Excel serial dəstəyi), e-poçt, ad, cins. Azərbaycan hərfləri (`ə ı ö ü ğ ş ç`) qorunur.
- **Uyğunlaşdırma mühərriki** — FİN-dəqiq → tam kimlik → qismən → fuzzy
  (Levenshtein, Jaro-Winkler). Yalnız ad/soyad eyniliyi dəqiq uyğunluq sayılmır.
- **Təkrar aşkarlanması** — eyni FİN/eyni şəxs, eyni FİN/fərqli ad, eyni ad/fərqli FİN,
  fuzzy ehtimal. Mənbə (fayl, vərəq, sətir) izlənilir.
- **Şəxsiyyət vəsiqəsi emalı** — PDF mətn çıxarışı (serverless `unpdf`), bir sənəddə/səhifədə
  **çoxlu vəsiqə seqmentasiyası**, DeepSeek ilə sahə çıxarışı (sxemlə yoxlanır), Yekun Siyahı
  ilə sahə-sahə müqayisə.
- **Yekun-mərkəzli panel və hesabatlar** — metrikalar, filtrlənə bilən cədvəl, şəxs detalı,
  düzəlişlər (təsdiq/geri al, audit), 6 vərəqli Excel ixracı.

## Memarlıq

```
src/
  app/                 # səhifələr (panel, yüklə, təkrarlar, düzəlişlər, hesabatlar, parametrlər)
    api/               # route handlers (excel/detect, excel/records, identity/extract, ai/status)
  components/          # UI (dropzone, sütun uyğunlaşdırma, şəxs detalı, və s.)
  lib/
    validation/        # deterministik yoxlama (FİN, telefon, tarix, e-poçt, ad, cins) + ad ayrılması
    excel/             # parse, sahə aşkarlama, qeyd qurma, ixrac
    matching/          # string oxşarlığı, uyğunlaşdırma mühərriki, təkrarlar
    pdf/               # PDF mətn çıxarışı (unpdf)
    document/          # çoxlu vəsiqə seqmentasiyası
    ai/                # provayderdən asılı olmayan AI qatı + DeepSeek + sənəd çıxarışı
    verification/      # Yekun-mərkəzli birləşdirici (sətirlər + metrikalar)
    store.tsx          # sessiya konteksti (brauzer yaddaşı)
```

**Vəziyyət:** Heç nə serverdə saxlanmır. Fayllar serverdə emal olunur, nəticələr brauzerə
qaytarılır və yalnız sessiya yaddaşında (`sessionStorage`) qalır. Bütün uyğunlaşdırma/yoxlama
hesablamaları brauzerdə (`buildVerification`) aparılır.

**İnterfeyslər arxasında:** `AIProvider` (DeepSeek → OpenAI və s. əlavə oluna bilər). Gələcəkdə
verilənlər bazası/növbə əlavə etmək üçün qat ayrılığı saxlanılıb.

## Quraşdırma

```bash
npm install
cp .env.example .env.local   # DEEPSEEK_API_KEY təyin edin (istəyə bağlı)
npm run dev                  # http://localhost:3000
```

### Mühit dəyişənləri (`.env.local`)

| Dəyişən | Təsvir |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek açarı. **Boş olduqda AI deaktiv olur** — deterministik yoxlama işləməyə davam edir. |
| `DEEPSEEK_BASE_URL` | Defolt: `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | Defolt: `deepseek-chat` |
| `AI_ENABLED` | `false` təyin etsəniz, açar olsa belə AI deaktiv olur. |

## Əmrlər

```bash
npm run dev      # inkişaf serveri
npm run build    # production build
npm start        # production server
npm test         # vitest (36 test: yoxlama, uyğunlaşdırma, aşkarlama, ad ayrılması)
```

## İş axını

1. **Yüklə** → Yekun Siyahı (`.xlsx`) — sütunları təsdiqlə.
2. **Yüklə** → Əsas Siyahı — Yekun ilə müqayisə olunur.
3. **Yüklə** → Şəxsiyyət vəsiqələri (PDF) — çıxarılır və Yekun ilə müqayisə olunur.
4. **Panel** → metrikalar, filtrlər, şəxs detalı.
5. **Düzəlişlər** → təhlükəsiz formatı düzəlişlərini təsdiqlə.
6. **Hesabatlar** → düzəldilmiş Yekun Siyahı + bütün hesabatları Excel kimi ixrac et.

## Məhdudiyyətlər (bu versiyada)

- **Saxlama yoxdur** — səhifə tam yeniləndikdə məlumat sıfırlanır (sessiya yaddaşı istisna).
- **OCR/şəkil yoxdur** — skan edilmiş PDF və şəkillər manual yoxlama üçün işarələnir
  (mətnli PDF-lər işləyir).
- **DOCX/DOC çevrilməsi yoxdur** — bu formatlar manual yoxlama üçün işarələnir.
- **Giriş (auth) yoxdur** — açıq rejim (istənilən vaxt əlavə oluna bilər).
- **AI balansı** — DeepSeek hesabında balans olmadıqda çağırış uğursuz olur və sistem
  deterministik (regex) çıxarışa keçir. Bu normaldır; balans artırılanda AI avtomatik işləyir.

## Netlify-a deploy

Repo Netlify-a bağlanır; `netlify.toml` və `@netlify/plugin-nextjs` konfiqurasiyası hazırdır.
Netlify panelində `DEEPSEEK_API_KEY` mühit dəyişənini əlavə edin.
