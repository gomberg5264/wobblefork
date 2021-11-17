<?php
require_once dirname(__FILE__) . '/handlers/jsonrpc_system.php'; # Exports the default system.listMethods and echo APICalls

/**
 * JsonRpcServer provides functionality to parse, validate and execute JSON-RPC 2.0 requests.
 *
 * Includes, by default, two methods: 'system.listMethods' and 'echo'.
 */
class JsonRpcServer {
  private $functions = array();
  private $functionTimeHistogram;

  public function __construct() {
    $this->addFunctions(array(
      array('file' => 'jsonrpc_system.php', 'name' => 'system.listMethods', 'method' => 'jsonrpc_exported_system_list'),
      array('file' => 'jsonrpc_system.php', 'name' => 'echo', 'method' => 'jsonrpc_echo')
    ));

    $this->functionTimeHistogram = Stats::histogramWithLabels(
      'jsonrpc_api_call_duration_milliseconds',
      [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 500, 1000, 2500, 5000, 100000],
      ['method', "code"]
    );
  }

  /**
   * See #addFunction()
   */
  public function addFunctions($defs) {
    foreach($defs as $def) {
      $this->addFunction($def['method'], isset($def['file']) ? $def['file'] : null, isset($def['name']) ? $def['name'] : null);
    }
  }

  /**
   * 
   */
  public function addFunction($method, $file = null, $name = null) {
    if (is_null($name)) {
      $name = $method;
    }

    $def = array();
    $def['method'] = $method;
    $def['name'] = $name;

    if (!is_null($file)) {
      $def['file'] = $file;
    }
    $this->functions[$name] = $def;
  }

  public function getExportedFunctions() {
    return $this->functions;
  }

  public function handleRequest($request) {
    if ($request === NULL) {
      return $this->createError(-32700, "Parse error");
    }

    # Is this a batch request? Route it as a batch request
    if (isset($request[0]) && is_array($request)) {
      return $this->processBatch($request);
    } else {
      return $this->processCall($request);
    }
  }

  protected function processBatch($batch) {
    $result = array();

    foreach ($batch as $subrequest) {
      $subresult = $this->processCall($subrequest);
      if ($subresult !== NULL) {
        $result[] = $subresult;
      }
    }

    return $result;
  }

  protected function processCall($request) {
    if ($request === NULL || !is_array($request)) {
      return $this->createError(-32600, "Invalid request");
    }

    # no jsonrpc-version
    if (!isset ($request['jsonrpc']))  {
      if (isset($request['id']))
        return $this->createError(-32600, 'Invalid Request: JSON-RPC-Version missing', $request['id']);
      else
        return $this->createError(-32600, 'Invalid Request: JSON-RPC-Version missing');
    }

    # no method given => invalid request
    if (!isset ($request['method']))  {
      if (isset($request['id']))
        return $this->createError(-32600, 'Invalid Request: Method missing', $request['id']);
      else
        return $this->createError(-32600, 'Invalid Request: Method missing');
    }

    if (!isset($request['params'])) {
      $request['params'] = array();
    }

    if (!isset($this->functions[$request['method']])) {
      return $this->createError(-32601, 'Method not found: '. $request['method'], $request['id']);
    }

    $export = $this->functions[$request['method']];

    try {
      if (isset($export['file'])) {
        require_once(WOBBLE_HOME . '/WobbleApi/handlers/' . $export['file']);
      }
      if (is_string($export['method']) && !function_exists($export['method'])) {
        if (isset($export['file']))
          throw new Exception("Expected that {$export['method']} gets defined in {$export['file']}. Function not found.");
        else
          throw new Exception("Function {$export['method']} was exported, but cannot be found.");
      }

      $this->beforeCall($request['method'], $request['params']);
      $startTime = microtime(true);
      $exception = null;
      $response = call_user_func($export['method'], $request['params'], $this);
    } catch(Exception $e) {
      $exception = $e;
      $response = null;
    }

    $endTime = microtime(true);

    $this->afterCall($request['method'], $request['params'], $response, $exception);

    $this->functionTimeHistogram->observe(
      ($endTime - $startTime) / 1000,
      [$request['method'], $response != null ? "200" : "500"]
    );

    if (isset($request['id'])) {
      if ($exception != null) {
        return $this->createError(-32603, $exception->getMessage(), $request['id']);
      } else {
        return $this->createResult($request['id'], $response);
      }
    } else {
      return NULL; # only return a result for requests with an id (no id => notification)
    }
  }

  protected function createResult($requestId, $resultObject) {
    $result = array(
      'jsonrpc' => '2.0',
      'result' => $resultObject
    );
    if ($requestId) {
      $result['id'] = $requestId;
    }
    return $result;
  }

  protected function createError($errorNo, $message, $requestId = false) {
    $result =  array(
      'jsonrpc' => '2.0',
      'error' => array (
        'code' => $errorNo,
        'message' => $message
      )
    );
    if ($requestId) {
      $result['id'] = $requestId;
    }
    return $result;
  }

  /**
   * Called before the actual jsonrpc method is invoked. Is intended to be overwritten.
   */
  protected function beforeCall($method, $params) {
  }
  /**
   * Called after the actual jsonrpc method was invoked. Is inteded to be overwritten.
   * $result is the return value of the invocation. $error the error that has been raised.
   * One of these two must always be <code>is_null</code>.
   */
  protected function afterCall($method, $params, $result, $error) {
  }
}
