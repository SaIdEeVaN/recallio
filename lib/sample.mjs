export const sample = {
 id:'sample',title:'The science of photosynthesis',subject:'Biology',format:'Sample notes',
 chunks:[
 {id:'S1',title:'From light to chemical energy',text:'Photosynthesis converts light energy into chemical energy stored in sugars. Plants use carbon dioxide from the air and water from the soil to build organic molecules. In plants, photosynthesis takes place inside chloroplasts.'},
 {id:'S2',title:'Capturing sunlight',text:'Chlorophyll absorbs light most strongly in the blue and red regions of the spectrum. Green light is reflected or transmitted, giving most leaves their green appearance. Chlorophyll is embedded in thylakoid membranes.'},
 {id:'S3',title:'The light-dependent reactions',text:'Light-dependent reactions take place in the thylakoid membranes. Water is split to supply electrons, releasing oxygen. Energy from electron transport helps produce ATP, while NADP+ is reduced to NADPH.'},
 {id:'S4',title:'Building sugars',text:'The Calvin cycle takes place in the stroma, the fluid surrounding the thylakoids. It uses ATP and NADPH from the light-dependent reactions to fix carbon dioxide and produce G3P, a building block for sugars.'},
 {id:'S5',title:'A leaf in balance',text:'Stomata are pores that regulate gas exchange. Opening them admits carbon dioxide but also allows water vapor to escape. When water is scarce, closing stomata reduces water loss and can limit photosynthesis.'}],
 summary:{sections:[{title:'How plants store sunlight',text:'Inside chloroplasts, plants use light to convert water and carbon dioxide into material for sugars. Chlorophyll in the thylakoid membranes captures energy from blue and red light.',refs:['S1','S2']},{title:'Two connected stages',text:'The light-dependent reactions split water, release oxygen, and produce ATP and NADPH. The Calvin cycle uses those energy carriers in the stroma to turn carbon dioxide into G3P.',refs:['S3','S4']},{title:'The cost of gas exchange',text:'Stomata let carbon dioxide enter a leaf. They also let water vapor escape, so conserving water can limit the carbon available for photosynthesis.',refs:['S5']}],terms:[{term:'Chlorophyll',definition:'The pigment in thylakoid membranes that absorbs light.',refs:['S2']},{term:'Stroma',definition:'The fluid around the thylakoids where the Calvin cycle occurs.',refs:['S4']},{term:'Stomata',definition:'Leaf pores that regulate gas exchange and water loss.',refs:['S5']}]},
 cards:[
 ['Where does photosynthesis take place in plants?','In chloroplasts.','Think of the organelle that contains chlorophyll.','S1'],
 ['Why do most leaves appear green?','Chlorophyll reflects or transmits much of the green light that reaches it.','Consider which colors chlorophyll absorbs.','S2'],
 ['What is the source of oxygen released during photosynthesis?','Water molecules split during the light-dependent reactions.','Look at the electron donor.','S3'],
 ['What does the Calvin cycle use ATP and NADPH to produce?','G3P from carbon dioxide. G3P is a building block for sugars.','Think of a three-carbon building block.','S4'],
 ['How does closing stomata affect a leaf?','It conserves water but restricts carbon dioxide entry and can limit photosynthesis.','Consider the trade-off between water and carbon.','S5']
 ].map(([front,back,hint,ref],i)=>({id:'c'+i,front,back,hint,refs:[ref],status:'new'})),
 messages:[], attempts:[],questionsCount:5,updated_at:null
};
