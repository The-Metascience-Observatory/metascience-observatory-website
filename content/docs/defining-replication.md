
# Defining Replication 

Generally speaking, we define a replication as "an experiment which is done to test an effect claim made in prior research." (following [Nosek & Errington, 2020](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.3000691))

In our [replications database](/replications-database) we distinguish four types of replications: 

**direct** — This is when a previously published experimental procedure is repeated as closely as possible to see if the same result can be obtained. Of course, there are always some unavoidable differences (different participants, different lab, different time period).

**"close experiment"** — Here scientists are testing for the same effect observed in a previous experiment, but they make one or maybe two deliberate changes to the experimental procedure. Importantly, the changes are small and focused. If the experimental changes become too large, then the replication drifts into becoming better described as a conceptual replication. 

**close extension** — Here scientists are testing whether an observed effect generalizes to a different setting. Typically, there is a theoretical reason for suspecting the effect will generalize. 

Note: Some close replications may have minor changes to both experiment and setting, and therefore can't be neatly categorized as either a close experiment or close extension, but we go with whichever one fits best. 

**conceptual** — The scientists are testing for the same effect observed in a previous experiment, but using a different experimental procedure. 

There are no clear boundaries between these categories. Rather, there is a spectrum from direct to conceptual. 

## Classifying the results of replication experiments

We classify the replication experiment results into four categories:

- **Successful** - the new experiment found evidence the effect exists.
- **Inconclusive** - the new experiment could not determine one way or another whether the effect exists. We try to avoid this categorization whenever possible.   
- **Unsuccessful** - the new experiment found evidence that the effect does not exist.
- **Reversal** - the new experiment found evidence for the opposite effect.

We pull effect size statistics when possible and try to normalize them to a 0-1 scale. See our page on that. 

## Other terms and types of replication... 

![Replication terms diagram](/docs/replication_terms.png)
*Figure: 49 replication terms used in the literature to distinguish types of replication. Most of these come from a [2010 survey](https://dl.acm.org/doi/10.1145/1852786.1852790) by Gómez et al. The intended meanings of many of these terms overlap.*

As we mentioned above, replication is a spectrum, ranging from direct replication to conceptual replication. We consider any experiment on that spectrum to be a replication. People have come up with many different terms: 

**"Technical" replication** (also called "robustness checking" or "data re-analysis") - where a new experiment is not done, but raw data from an existing experiment is reanalyzed using the reported procedures. Or, it may involve simply running provided code on data to get results (this is called "frictionless reproduction"). We do not consider re-analyses of previously published data to be replication experiments, so our database does not contain technical replications. 

**"Internal replication"** - this is where the same lab / group does a replication of a previous experiment they did. In the course of creating the replication database, we've found several cases where an experiment and an internal replication experiment are reported in the same paper. We have decided not to include them. The database does contain a few internal replications that were reported in separate papers, mainly because they are hard to weed out. 

## Other points of clarification 

### We are interested in effects, not papers

We believe the proper level of analysis is effects, not papers. While it is often true that scientific papers have one central claim, a lot of papers report many effects. A replication paper may replicate some of those effects and fail to replicate others.

### The discovery of mistakes in prior analyses are not "replication failures"

We are interested in the discovery of mistakes, but we consider them "errata", not replication failures. 

### How we determine the "original experiment" 

For direct and close replications, the authors almost always reference a specific experiment they were trying to replicate or extend, and if they don't we are unable to ingest the paper into our database. For conceptual replications, the authors generally cite several previous experiments that found the effect. For conceptual replications, we currently use the earliest published experiment referenced by the authors as the "original experiment", even though there may be earlier studies reporting the same effect. We realize this isn't ideal, and this may be improved as we work on our system for incorporating conceptual replications into our database. 

## Some more thoughts on our philosophy of science...

The act of taking down experimental measurements by itself does not constitute science any more than collecting stamps or watching birds could be considered doing science. The heart and soul of science is abstracting away from individual observations to develop theories that have predictive power. Science progresses through better theories - whether they be more elegant, more general, or more precise. Theorizing is the heart of science, and to understand the health of science we must understand how good a job scientists are doing at theorizing. Today, many areas of science are very atheoretical, to the point that one may question the degree to which they are science at all. Of course, experimentation helps to inform and inspire theorizing, but all experiments themselves are theory-laden. Whether the observations of a particular experiment can be replicated is interesting, but more interesting is whether theories hold up to repeated experimental assaults. 

Therefore, we are most interested in the replicability of the general effects that scientists claim on the basis of their theories, not whether a particular narrow observation can be replicated. Consider a clinical trial on Prozac. In a narrow sense all the experiment may have shown was that "Prozac helps with depression in people diagnosed with depression by a clinician at a Houston-area hospital system in the years 2010-2015", but based on theoretical considerations, the authors claim their work gives strong evidence for the general effect that "Prozac helps with depression for all humans". This is based on a theoretical understanding of how the brain works. Other examples of general claims are "neutrinos can travel faster than light", "the MMR vaccine causes autism", "power posing increases success in job interviews", and "water can exist in a polymerized form" (all of those claims failed replication and are now considered false).
