CALL gds.graph.project(
    'actor-directors',
    ['??????', '??????'],
    '??????'
)

CALL gds.degree.stream('actor-directors')
YIELD nodeId, score
RETURN 
  gds.util.asNode(nodeId).name AS name, 
  score AS movies
ORDER BY ?????? DESC