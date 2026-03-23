import AboutHero from '@/components/about/aboutHero'
import Team from '@/components/about/team'
import ValuesComponent from '@/components/about/values'
import AboutComponent from '@/components/home/about'
import Layout from '@/components/layout'
import React from 'react'

const About = () => {
  return (
    <Layout>
        <AboutHero/>
        <AboutComponent/>
        <ValuesComponent/>
        <Team/>
    </Layout>
  )
}

export default About