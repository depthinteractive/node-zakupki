import React from 'react';
import { Switch, Route } from 'react-router-dom';
import CustomerStory from './Components/CustomerStory';

function App() {
  return (
    <Switch>
      <Route path="/customer/story/:inn" render={ ({match}) => <CustomerStory inn={match.params.inn} /> }/>
      <Route>
        Nothing to show
      </Route>
    </Switch>
  );
}

export default App;
