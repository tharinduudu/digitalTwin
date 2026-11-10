import { RateExperiment } from './investigation-model.js';
self.onmessage = ({data}) => {
  try {
    const experiment=new RateExperiment(data);
    const total=data.samples || 800000;
    for(let done=0;done<total;done+=10000) {
      experiment.advance(Math.min(10000,total-done));
      self.postMessage({progress:Math.min(total,done+10000)/total});
    }
    self.postMessage({result:experiment.result()});
  } catch(error) {self.postMessage({error:error.message});}
};
