import { NextRequest, NextResponse } from 'next/server';
import { publicArticle, releaseVersion } from '@/lib/long-covid/articles-server';
export const runtime='nodejs';
export function GET(request:NextRequest){
 const id=request.nextUrl.searchParams.get('id');
 if(!id || id.length>512)return NextResponse.json({error:'A valid article ID is required'},{status:400});
 const version=releaseVersion();const requested=request.nextUrl.searchParams.get('version');
 if(requested && requested!==version)return NextResponse.json({error:'This review has been updated. Refresh the page.'},{status:409});
 const detail=publicArticle(id);
 return detail?NextResponse.json(detail,{headers:{'Cache-Control':'public, max-age=300, must-revalidate','ETag':`"${version}-${encodeURIComponent(detail.paperId)}"`}}):NextResponse.json({error:'Article is not in the published review'},{status:404});
}
