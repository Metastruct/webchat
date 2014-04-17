<?php

//error_reporting(E_ALL);ini_set('display_errors','On');
	require_once('sso.php');
//error_reporting(E_ALL);ini_set('display_errors','On');

$S = sso::sso(); 

$S->login(); // LOGIN ONLY

header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");
header("Cache-Control: no-cache");
header("Pragma: no-cache");

function base64url_encode($data) { 
   return rtrim(strtr(base64_encode($data), '+/', '-_'), '='); 
 }
function MakeResetKey($min_length = 32, $max_length = 64) 
 { 
    $key = ''; 

    // build range and shuffle range using ASCII table 
    for ($i=0; $i<=255; $i++) { 
       $range[] = chr($i); 
    } 

    // shuffle our range 3 times 
    for ($i=0; $i<=3; $i++) { 
       shuffle($range); 
    } 

       // loop for random number generation 
    for ($i = 0; $i < mt_rand($min_length, $max_length); $i++) { 
       $key .= $range[mt_rand(0, count($range))]; 
    } 

    $return = base64url_encode($key); 

    if (!empty($return)) { 
       return $return; 
    } else { 
       return 0; 
    } 
 }

 
$steamid=$S->steamid();

$token = MakeResetKey();

$info = $S->info($steamid);
$personaname = $info['personaname']; 

$a = array($token,$steamid,$personaname);


$data = array('data' => json_encode($a));

// use key 'http' even if you send the request to https://...
$options = array(
    'http' => array(
        'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
        'method'  => 'POST',
        'content' => http_build_query($data),
    ),
);
$context  = stream_context_create($options);
$result = file_get_contents("http://sso.metastruct.uk.to/rocket/webchat.py", false, $context);

if ($result!="OK") {
    die("Sorry, but web chat is currently offline :(\n<br /><br />\n");
}

header("Location: http://metastruct.org/webchat/chat.html#" . $token,TRUE,307);

?>