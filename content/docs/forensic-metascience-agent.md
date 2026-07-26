# The Forensic Metascience Agent



The Forensic Metascience Agent is an AI agent equipped with 30+ tools for "sanity checking" the statistics and data presented in scientific papers. Much of it is based directly off of James Heathers' book  [*An Introduction to Forensic Metascience*](https://doi.org/10.5281/zenodo.14871843). 


The Forensic Metascience Agent is meant to compliment other automated and semi-automated systems for detecting improper image duplication and image manipulation like [Proofig](https://www.proofig.com/), [ImageTwin](https://imagetwin.ai/), and [RevewerZero.ai](https://www.reviewerzero.ai/research). It is also complementary to the copypaste detection system for scrutinizing open source datasets developed by Markus Englund at [ScienceDetective.org](https://www.sciencedetective.org/scientific-datasets-are-riddled-with-copy-paste-errors/).


Reported statistics are internally redundant: a mean of integer-scaled responses can only take certain values for a given sample size; a standard deviation is bounded by the range of the measurement; a t-statistic, its degrees of freedom, and its p-value must agree with one another; two "independent" studies should not report identical means and standard deviations down to the second decimal place. When the reported numbers violate these constraints, something is wrong — a typo, a copy-paste slip, a miscalculation, or worse.


## What should be reported, and how? 

At some point we might report every mathematical impossibility and statistical error we find on PubPeer. However, most errors are simple mistakes, and many are utterly inconsequential. The spectre of false positives is also very real when it comes to using AI, which is not 100% accurate at applying these tools (it may, for instance, apply GRIM on data that is actually continuous, not discrete). So, every finding found by the AI undergoes human review and scrutiny. Right now, it takes a lot for something to rise to the level of "we should report this on PubPeer / widely publicize this".

 

<!-- TOOLKIT --> 