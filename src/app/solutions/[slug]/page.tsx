import Layout from '@/components/layout'
import React from 'react'
import Read, {generateStaticParams, generateMetadata} from '@/app/solutions/[slug]/read'

export {generateStaticParams, generateMetadata}

const Solution = (props: any) => {
  return (
    <Layout>
        <Read {...props} />
    </Layout>
  )
}

export default Solution