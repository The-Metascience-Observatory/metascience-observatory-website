import { reviewVersion, reviewArticles, reviewArticle } from '../birds-eye-reviews/data';
export const releaseVersion = () => reviewVersion('long-covid');
export const publishedArticles = () => reviewArticles('long-covid');
export const publicArticle = (id: string) => reviewArticle('long-covid', id);
