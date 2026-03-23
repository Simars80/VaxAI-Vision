import React from 'react'
import Post, {generateMetadata, generateStaticParams} from '@/app/blog/[slug]/post'
import Layout from '@/components/layout';

export { generateMetadata, generateStaticParams };

const BlogPost = (props: any) => {
  return (
    <Layout>
        <Post {...props} />
    </Layout>
  )
}

export default BlogPost