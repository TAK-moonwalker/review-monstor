import * as XLSX from 'xlsx';

export const exportJudgeMeReviews = (reviews) => {
  const eligible = reviews.filter(
    (r) =>
      r.permissionGranted === true &&
      r.productHandle &&
      (r.status === 'ready' || r.status === 'published'),
  );

  const rows = eligible.map((r) => {
    const pics = [
      ...(r.postcardImageUrl ? [r.postcardImageUrl] : []),
      ...(Array.isArray(r.pictureUrls) ? r.pictureUrls : []),
    ];

    return {
      product_handle: r.productHandle || '',
      reviewer_name: r.reviewerName || '',
      reviewer_email: r.reviewerEmail || '',
      rating: r.rating ?? '',
      title: r.title || '',
      body: r.body || r.cleanedTextJa || r.translationEn || '',
      review_date: r.reviewDate || '',
      picture_urls: pics.join(', '),
      verified: r.verified ? 'TRUE' : 'FALSE',
      reply: r.reply || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reviews');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `judgeme_reviews_${date}.xlsx`);

  return eligible.map((r) => r.id);
};

// Legacy alias
export const exportToJudgeMe = exportJudgeMeReviews;
