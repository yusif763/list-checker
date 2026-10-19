# Siyahı Yoxlama Sistemi

AI əsaslı **Excel və şəxsiyyət sənədi yoxlama platforması** — **layihə (sessiya) əsaslı**,
davamlı saxlamalı. Next.js (App Router) + TypeScript, tam **Netlify-a uyğun**.

İnterfeys tam **Azərbaycan dilindədir**.

> **Əsas qayda:** Yekun Siyahı əsas mənbədir. Bütün yoxlama, müqayisə və hesabatlar onun
> şəxsləri ətrafında qurulur. İstiqamət həmişə **Yekun → Əsas** və **Yekun ↔ Vəsiqə**.

## Layihə sistemi

Hər layihənin (məs. "Sabirabad") öz məlumatı ayrıca saxlanılır:

1. **Yekun siyahı** — əsas məlumat mənbəyi.
2. **Əsas siyahı** — Yekun ilə müqayisə üçün istinad.
3. **Şəxsiyyət vəsiqələri** — PDF, Word və şəkil; tək və ya toplu (bir faylda çox vəsiqə).

Layihələr, fayllar və nəticələr **Netlify Blobs**-da saxlanılır (lokal inkişafda `.data/`).
İstifadəçi sonra qayıdıb nəticələri görə, yeni fayl əlavə edə və yenidən emal edə bilər.

## İş axını (layihə daxilində)

1. **Yüklə** — Yekun, Əsas və vəsiqə fayllarını layihəyə bağla.
2. **Vəsiqə emalı** — addım-addım: hər fayl ayrıca emal olunur, status (gözləyir/emal/hazır/xəta)
   görünür, uğursuzlar təkrar emal edilə bilir. Bir xəta bütün prosesi dayandırmır.
3. **Nəticələr** — metrikalar, filtrlənən cədvəl, şəxs detalı (sahə-sahə müqayisə), düzəlişlər.
4. **Hesabat** — düzəldilmiş Yekun + tam hesabat + səhvlər + əsasda yoxlar + vəsiqə
   uyğunsuzluqları + təkrarlar, bir Excel faylında.

## Nə işləyir

- **AI-əsaslı Excel strukturu** — başlıq sətri avtomatik tapılır (hətta 5-ci sətirdə),
  **başlıqsız fayllar** AI ilə dəyərlərdən təhlil olunur, çoxlu vərəq arasından ən zəngin
  vərəq seçilir, fərqli sütun adları (AZ/EN).
- **Birləşmiş ad ayrılması** — "Soyadı, Adı, Atasının adı" (oğlu/qızı ilə və ya olmadan).
- **Deterministik yoxlama** — FİN, telefon `(0XX) XXX XX XX`, tarix `GG.AA.İİİİ` (Excel serial),
  e-poçt, ad, cins. Azərbaycan hərfləri qorunur.
- **Vəsiqə çıxarışı (DeepSeek vision OCR)** — Word daxilindəki ID şəkilləri, müstəqil şəkillər
  (JPG/PNG/WEBP) və mətnli PDF/Word. Bir sənəddə çoxlu vəsiqə ayrı-ayrı emal olunur.
- **Uyğunlaşdırma** — FİN-dəqiq → tam kimlik → fuzzy (Levenshtein/Jaro-Winkler).
- **Bütün sütunların müqayisəsi** — ad, FİN, doğum, cins, vəzifə, fənn, rayon, müəssisə.
- **Təkrar aşkarlanması**, düzəlişlər (audit) və Excel ixracı.

## Memarlıq

```
src/
  app/
    api/projects/...   # layihə CRUD, upload, process (addım-addım), corrections, fayl
    layihe/[id]/       # layihə iş sahəsi (yüklə / emal / nəticələr / hesabat)
  components/project/  # upload-panel, process-panel, results-panel
  lib/
    storage/           # Netlify Blobs + lokal fayl sistemi fallback
    projects/          # layihə modeli, repozitoriya, client
    excel/             # parse, AI struktur analizi, qeyd qurma, ixrac
    ai/                # DeepSeek (mətn + vision), struktur/sütun aşkarlama, çıxarış
    document/          # Word şəkil çıxarışı, seqmentasiya, vəsiqə emalı
    matching/ validation/ verification/
```

## Quraşdırma

```bash
npm install
cp .env.example .env.local   # DEEPSEEK_API_KEY təyin edin
npm run dev                  # http://localhost:3000
```

### Mühit dəyişənləri

| Dəyişən | Təsvir |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek açarı (mətn + vision). Boşdursa AI deaktiv, deterministik yoxlama işləyir. |
| `DEEPSEEK_BASE_URL` | Defolt `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | Defolt `deepseek-chat` |
| `DEEPSEEK_VISION_MODEL` | Vision model (defolt `deepseek-chat`) |

Netlify-da bu dəyişənləri panel → Environment variables bölməsində əlavə edin.

## Əmrlər

```bash
npm run dev | build | start
npm test     # vitest (yoxlama, uyğunlaşdırma, aşkarlama, ad ayrılması)
```

## Məhdudiyyətlər

- **Skan edilmiş PDF** (şəkil qatlı) hələ OCR olunmur — Word/şəkil vəsiqələri işləyir.
- Köhnə `.doc` (yalnız `.docx`) dəstəklənmir.
- Giriş (auth) yoxdur — açıq rejim.
- Skan/oxunmayan vəsiqələr "manual yoxlama" kimi işarələnir və təkrar emal edilə bilir.
